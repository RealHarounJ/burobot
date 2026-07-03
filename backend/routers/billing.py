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
