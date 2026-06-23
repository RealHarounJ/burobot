"""
BuroBot — Normattiva Scraper & Parser Service
Gestisce il download e la conversione delle leggi dal portale Normattiva.
"""

import httpx
import re
import os
from pathlib import Path
from bs4 import BeautifulSoup

KNOWLEDGE_BASE_PATH = Path(__file__).parent.parent / "knowledge_base"

def sanitize_filename(name: str) -> str:
    """Converte un titolo in un nome file sicuro per la memorizzazione."""
    s = name.lower()
    s = re.sub(r'[^a-z0-9_]', '_', s)
    s = re.sub(r'_+', '_', s)
    return s.strip('_')

async def scrape_normattiva_law(url: str) -> tuple[str, str]:
    """
    Scarica una legge da Normattiva e restituisce (titolo, testo_markdown).
    Risolve le sessioni del server ed estrae il testo intero dall'area di export.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    
    # 1. Stabilisce la sessione effettuando una prima chiamata all'URL fornito
    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        print(f"Stato: stabilendo la sessione Normattiva con {url}")
        resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            raise ValueError(f"Impossibile accedere all'URL. Stato HTTP: {resp.status_code}")
            
        # 2. Cerca il link di export del testo completo dell'atto
        export_link = None
        match = re.search(r'href=["\'](/esporta/attoCompleto\?.*?)["\']', resp.text)
        if match:
            export_link = "https://www.normattiva.it" + match.group(1)
        else:
            # Tenta di ricostruire l'URL dai parametri della pagina o del reindirizzamento
            url_str = str(resp.url)
            gazzetta_match = re.search(r'atto\.dataPubblicazioneGazzetta=([\d-]+)', url_str)
            codice_match = re.search(r'atto\.codiceRedazionale=(\w+)', url_str)
            
            if not gazzetta_match or not codice_match:
                gazzetta_match = re.search(r'atto\.dataPubblicazioneGazzetta=([\d-]+)', resp.text)
                codice_match = re.search(r'atto\.codiceRedazionale=(\w+)', resp.text)
                
            if gazzetta_match and codice_match:
                gazzetta = gazzetta_match.group(1)
                codice = codice_match.group(1)
                export_link = f"https://www.normattiva.it/esporta/attoCompleto?atto.dataPubblicazioneGazzetta={gazzetta}&atto.codiceRedazionale={codice}"
                
        if not export_link:
            raise ValueError(
                "Impossibile identificare i parametri dell'atto o il link per l'esportazione del testo completo. "
                "Assicurati che sia un URL ufficiale di Normattiva valido."
            )
            
        print(f"Stato: scaricamento testo completo da {export_link}")
        export_resp = await client.get(export_link, headers=headers)
        if export_resp.status_code != 200:
            raise ValueError(f"Impossibile scaricare il testo dell'atto. Stato HTTP: {export_resp.status_code}")
            
        html = export_resp.text
        if "Errore nel caricamento delle informazioni" in html:
            raise ValueError(
                "Il server di Normattiva ha rifiutato la richiesta di esportazione o la sessione è scaduta. "
                "Si prega di riprovare tra qualche istante."
            )
            
        # 3. Parsing HTML e conversione in Markdown pulito
        soup = BeautifulSoup(html, 'html.parser')
        main_div = soup.find(id="printThis")
        if not main_div:
            raise ValueError("Impossibile individuare il contenitore principale del testo della legge (id='printThis').")
            
        for s in main_div(["script", "style"]):
            s.decompose()
            
        markdown_lines = []
        
        # Estrazione del titolo
        title_elem = main_div.find(class_="titolo-provvedimento")
        if title_elem:
            title_text = title_elem.get_text(strip=True)
            markdown_lines.append(f"# {title_text}\n\n")
        else:
            h1 = main_div.find(["h1", "h2"])
            if h1:
                title_text = h1.get_text(strip=True)
                markdown_lines.append(f"# {title_text}\n\n")
            else:
                title_text = "Atto Normativo Importato"
                markdown_lines.append(f"# {title_text}\n\n")
                
        # Estrazione degli articoli e dei commi
        articles = main_div.find_all(class_="art-commi-div-akn")
        if articles:
            for art in articles:
                art_num_elem = art.find(class_=["article-num-akn", "art-num-akn"])
                art_num = art_num_elem.get_text(strip=True) if art_num_elem else ""
                
                art_head_elem = art.find(class_="article-heading-akn")
                art_head = art_head_elem.get_text(strip=True) if art_head_elem else ""
                
                if art_num:
                    markdown_lines.append(f"\n\n## {art_num}")
                    if art_head:
                        markdown_lines.append(f"\n### {art_head}\n")
                    else:
                        markdown_lines.append("\n")
                        
                commi = art.find_all(class_="art-comma-div-akn")
                for comma in commi:
                    comma_num_elem = comma.find(class_="comma-num-akn")
                    comma_num = comma_num_elem.get_text(strip=True) if comma_num_elem else ""
                    
                    comma_text_elem = comma.find(class_="art_text_in_comma")
                    comma_text = comma_text_elem.get_text(strip=True) if comma_text_elem else ""
                    
                    if comma_num or comma_text:
                        markdown_lines.append(f"\n{comma_num} {comma_text}")
                        
                notes = art.find_all(class_="nota-art-akn")
                for note in notes:
                    markdown_lines.append(f"\n\n*Note: {note.get_text(strip=True)}*")
        else:
            # Fallback in caso di struttura atipica dell'atto
            print("Avviso: struttura ad articoli non trovata, estrazione del testo lineare.")
            markdown_lines.append(main_div.get_text(separator="\n"))
            
        md_text = "".join(markdown_lines)
        cleaned_md = re.sub(r'\n{3,}', '\n\n', md_text)
        cleaned_md = re.sub(r' +', ' ', cleaned_md)
        
        # Assicura la presenza della directory di destinazione
        normattiva_dir = KNOWLEDGE_BASE_PATH / "normattiva"
        os.makedirs(normattiva_dir, exist_ok=True)
        
        # Scrittura del file Markdown
        filename = sanitize_filename(title_text) + ".md"
        filepath = normattiva_dir / filename
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(cleaned_md)
            
        print(f"Legge salvata in: {filepath} ({len(cleaned_md)} caratteri)")
        return title_text, filename
