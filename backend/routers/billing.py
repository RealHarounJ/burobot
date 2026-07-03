"""
BuroBot — Billing Router
Gestisce abbonamenti Stripe, checkout e webhook.
"""

from fastapi import APIRouter, HTTPException, Request, Header, Depends
from pydantic import BaseModel
import stripe
import os
from supabase import create_client
from dependencies import get_current_user

router = APIRouter()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").strip()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "").strip()

PRICE_MAP = {
    "pro": os.getenv("STRIPE_PRICE_PRO") or os.getenv("STRIPE_PRICE_BASE"),
    "base": os.getenv("STRIPE_PRICE_BASE"),
    "pmi": os.getenv("STRIPE_PRICE_PMI"),
    "studio": os.getenv("STRIPE_PRICE_STUDIO"),
}

PLAN_NAMES = {
    "pro": "BuroBot Pro",
    "base": "BuroBot Base",
    "pmi": "BuroBot PMI",
    "studio": "BuroBot Studio",
}


class CheckoutRequest(BaseModel):
    plan: str  # "base", "pmi", "studio"


@router.post("/create-checkout")
async def create_checkout(request: CheckoutRequest, user=Depends(get_current_user)):
    """Crea una sessione di pagamento Stripe."""
    if request.plan not in PRICE_MAP:
        raise HTTPException(status_code=400, detail="Piano non valido")
    
    price_id = PRICE_MAP[request.plan]
    if not price_id:
        raise HTTPException(status_code=500, detail="Prezzo non configurato")
    
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{FRONTEND_URL}/dashboard?upgraded=true",
            cancel_url=f"{FRONTEND_URL}/pricing",
            customer_email=user.email,
            metadata={"user_id": user.id, "plan": request.plan},
            subscription_data={
                "metadata": {"user_id": user.id, "plan": request.plan}
            }
        )
        return {"checkout_url": session.url}
    except stripe.StripeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-portal")
async def create_customer_portal(user=Depends(get_current_user)):
    """Crea un link al portale clienti Stripe per gestire l'abbonamento."""
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    profile = supabase.table("profiles").select("stripe_customer_id").eq("id", user.id).single().execute()
    customer_id = profile.data.get("stripe_customer_id") if profile.data else None
    
    if not customer_id:
        raise HTTPException(status_code=404, detail="Nessun abbonamento attivo trovato")
    
    portal = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{FRONTEND_URL}/dashboard"
    )
    return {"portal_url": portal.url}


@router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    """
    Webhook Stripe — aggiorna il piano utente nel database
    in base agli eventi di pagamento.
    """
    payload = await request.body()
    
    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Webhook signature non valida")
    
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session["metadata"].get("user_id")
        plan = session["metadata"].get("plan", "base")
        customer_id = session.get("customer")
        
        if user_id:
            supabase.table("profiles").upsert({
                "id": user_id,
                "plan": plan,
                "stripe_customer_id": customer_id,
            }).execute()
    
    elif event["type"] in ["customer.subscription.deleted", "customer.subscription.paused"]:
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")
        
        # Trova utente per customer_id e passa a free
        profile = supabase.table("profiles") \
            .select("id") \
            .eq("stripe_customer_id", customer_id) \
            .single() \
            .execute()
        
        if profile.data:
            supabase.table("profiles").update({"plan": "free"}).eq("id", profile.data["id"]).execute()
    
    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")
        status = subscription.get("status")
        
        if status == "active":
            metadata = subscription.get("metadata", {})
            plan = metadata.get("plan", "base")
            
            profile = supabase.table("profiles") \
                .select("id") \
                .eq("stripe_customer_id", customer_id) \
                .single() \
                .execute()
            
            if profile.data:
                supabase.table("profiles").update({"plan": plan}).eq("id", profile.data["id"]).execute()
    
    return {"received": True}


# =============================================
# GESTIONE TEAM E COLLABORATORI
# =============================================

class TeamInviteRequest(BaseModel):
    email: str
    role: str = "collaboratore"

class AcceptInviteRequest(BaseModel):
    invite_id: str


def send_invitation_email(to_email: str, invite_id: str, inviter_name: str):
    resend_api_key = os.getenv("RESEND_API_KEY", "").strip()
    if not resend_api_key:
        print("RESEND_API_KEY non configurata. Salto invio email reale.")
        return False

    frontend_url = os.getenv("FRONTEND_URL", "https://frontend-omega-six-95.vercel.app").strip().rstrip("/")
    invite_link = f"{frontend_url}/register?invite={invite_id}&email={to_email}"

    payload = {
        "from": "BuroBot <onboarding@resend.dev>",
        "to": [to_email],
        "subject": f"Sei stato invitato nel team di BuroBot da {inviter_name}!",
        "html": f"""
        <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
            <h2 style="color: #6366f1; text-align: center;">Benvenuto su BuroBot!</h2>
            <p>Ciao,</p>
            <p><strong>{inviter_name}</strong> ti ha invitato a unirti al suo team su BuroBot come collaboratore.</p>
            <p>BuroBot è l'assistente basato su intelligenza artificiale per comprendere e contestare la burocrazia italiana.</p>
            <div style="margin: 30px 0; text-align: center;">
                <a href="{invite_link}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Accetta l'invito ed Unisciti al Team</a>
            </div>
            <p style="font-size: 12px; color: #718096; margin-top: 20px; border-top: 1px solid #edf2f7; padding-top: 20px;">
                Se il pulsante sopra non funziona, copia e incolla questo indirizzo nel tuo browser:<br>
                <a href="{invite_link}" style="color: #6366f1;">{invite_link}</a>
            </p>
        </div>
        """
    }

    import urllib.request
    import json
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {resend_api_key}",
            "Content-Type": "application/json",
            "User-Agent": "BuroBot/1.0"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status in (200, 201)
    except Exception as e:
        print(f"Errore chiamata API Resend: {e}")
        return False


@router.get("/team/members")
async def get_team_members(user=Depends(get_current_user)):
    """Restituisce i collaboratori attivi e gli inviti in attesa per l'utente."""
    from routers.documents import get_supabase
    supabase = get_supabase()

    # Membri attivi (profiles con team_owner_id == user.id)
    members_res = supabase.table("profiles").select("email, full_name, plan").eq("team_owner_id", user.id).execute()
    members = []
    for m in (members_res.data or []):
        members.append({
            "name": m.get("full_name") or m.get("email"),
            "email": m.get("email"),
            "role": "collaboratore",
            "status": "attivo"
        })

    # Inviti in attesa (dalla tabella team_invitations)
    invites_res = supabase.table("team_invitations").select("id, email, role").eq("team_owner_id", user.id).execute()
    invites = []
    for i in (invites_res.data or []):
        invites.append({
            "name": "",
            "email": i.get("email"),
            "role": i.get("role"),
            "status": "in attesa"
        })

    return {"members": members + invites}


@router.post("/team/invite")
async def invite_team_member(request: TeamInviteRequest, user=Depends(get_current_user)):
    """Invita un nuovo collaboratore inviando l'email tramite Resend."""
    from routers.documents import get_supabase, ADMIN_EMAILS
    supabase = get_supabase()

    # Verifica se l'utente ha il piano Pro (o vecchi piani) per invitare collaboratori
    profile = supabase.table("profiles").select("plan, full_name, email").eq("id", user.id).single().execute()
    plan = profile.data.get("plan", "free") if profile.data else "free"
    inviter_name = (profile.data.get("full_name") if profile.data else "") or (profile.data.get("email") if profile.data else "") or "Un utente BuroBot"

    if plan not in ("pro", "base", "pmi", "studio") and user.email.lower() not in ADMIN_EMAILS:
        raise HTTPException(
            status_code=402,
            detail="La funzionalità di gestione team è riservata agli utenti BuroBot Pro."
        )

    email_clean = request.email.strip().lower()

    # Inserisci l'invito nel database (upsert per evitare doppioni)
    invite_res = supabase.table("team_invitations").upsert({
        "team_owner_id": user.id,
        "email": email_clean,
        "role": request.role
    }).execute()

    invite_id = invite_res.data[0]["id"] if (invite_res.data and len(invite_res.data) > 0) else None
    if not invite_id:
        raise HTTPException(status_code=500, detail="Impossibile creare l'invito nel database")

    # Invia l'email reale via Resend
    email_sent = send_invitation_email(email_clean, invite_id, inviter_name)

    return {
        "success": True,
        "message": "Invito inviato con successo" if email_sent else "Invito salvato nel database (API Resend non configurata)",
        "email_sent": email_sent
    }


@router.delete("/team/members/{email}")
async def remove_team_member(email: str, user=Depends(get_current_user)):
    """Rimuove un collaboratore attivo o annulla un invito pendente."""
    from routers.documents import get_supabase
    supabase = get_supabase()
    email_clean = email.strip().lower()

    # Prova a rimuovere un invito pendente
    supabase.table("team_invitations").delete().eq("team_owner_id", user.id).eq("email", email_clean).execute()

    # Prova a dissociare un membro attivo
    supabase.table("profiles").update({"team_owner_id": None}).eq("team_owner_id", user.id).eq("email", email_clean).execute()

    return {"success": True, "message": "Collaboratore rimosso correttamente"}


@router.post("/team/accept-invite")
async def accept_team_invite(request: AcceptInviteRequest, user=Depends(get_current_user)):
    """Accetta un invito collegando l'utente corrente al team owner."""
    from routers.documents import get_supabase
    supabase = get_supabase()

    # Trova l'invito
    invite = supabase.table("team_invitations").select("*").eq("id", request.invite_id).single().execute()
    if not invite.data:
        raise HTTPException(status_code=404, detail="Invito non trovato o già scaduto")

    team_owner_id = invite.data["team_owner_id"]

    # Aggiorna il profilo del collaboratore
    supabase.table("profiles").update({"team_owner_id": team_owner_id}).eq("id", user.id).execute()

    # Elimina l'invito
    supabase.table("team_invitations").delete().eq("id", request.invite_id).execute()

    return {"success": True, "message": "Invito accettato con successo"}
