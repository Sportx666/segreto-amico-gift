export default function Cookies() {
  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Cookie Policy</h1>
      
      <div className="prose prose-gray max-w-none space-y-8">
        <section>
          <p className="text-muted-foreground mb-6">
            Questa Cookie Policy spiega cosa sono i cookie e come li utilizziamo sul nostro sito web.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">1. Cosa sono i Cookie</h2>
          <p className="mb-4">
            I cookie sono piccoli file di testo che vengono memorizzati sul dispositivo dell&apos;utente 
            quando visita un sito web. I cookie permettono al sito di riconoscere il dispositivo 
            dell&apos;utente e memorizzare alcune informazioni sulle sue preferenze o azioni passate.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">2. Tipi di Cookie Utilizzati</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">2.1 Cookie Tecnici (Necessari)</h3>
            <p className="mb-4">
              Questi cookie sono essenziali per il funzionamento del sito web e non possono essere disabilitati:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Cookie di autenticazione:</strong> per mantenere l&apos;utente connesso durante la sessione</li>
              <li><strong>Cookie di sicurezza:</strong> per prevenire attacchi informatici e proteggere i dati</li>
              <li><strong>Cookie di sessione:</strong> per memorizzare temporaneamente le informazioni durante la navigazione</li>
              <li><strong>Cookie di preferenze:</strong> per ricordare le impostazioni scelte dall&apos;utente</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              <strong>Base giuridica:</strong> Interesse legittimo per il funzionamento del servizio
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">2.2 Cookie Analitici</h3>
            <p className="mb-4">
              Utilizzati per raccogliere informazioni sull&apos;utilizzo del sito web in forma anonima:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Google Analytics:</strong> per analizzare il traffico e l&apos;utilizzo del sito</li>
              <li><strong>Cookie di performance:</strong> per monitorare le prestazioni del sito</li>
              <li><strong>Cookie di misurazione:</strong> per comprendere l&apos;efficacia dei contenuti</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              <strong>Base giuridica:</strong> Consenso dell&apos;utente (opzionale)
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">2.3 Cookie di Terze Parti</h3>
            <p className="mb-4">
              Il nostro sito può utilizzare servizi di terze parti che installano i propri cookie:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Servizi di autenticazione:</strong> per il login tramite provider esterni</li>
              <li><strong>Servizi di condivisione:</strong> per la condivisione sui social media</li>
              <li><strong>Servizi di supporto:</strong> per il funzionamento di chat o assistenza</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. Durata dei Cookie</h2>
          <p className="mb-4">
            I cookie utilizzati hanno diverse durate:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li><strong>Cookie di sessione:</strong> vengono eliminati alla chiusura del browser</li>
            <li><strong>Cookie persistenti:</strong> rimangono memorizzati per un periodo determinato</li>
            <li><strong>Cookie tecnici:</strong> generalmente fino a 1 anno</li>
            <li><strong>Cookie analitici:</strong> fino a 26 mesi (Google Analytics)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. Gestione dei Cookie</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">4.1 Impostazioni del Browser</h3>
            <p className="mb-4">
              È possibile gestire i cookie attraverso le impostazioni del proprio browser:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Chrome:</strong> Impostazioni → Avanzate → Privacy e sicurezza → Impostazioni sito → Cookie</li>
              <li><strong>Firefox:</strong> Opzioni → Privacy e sicurezza → Cookie e dati dei siti web</li>
              <li><strong>Safari:</strong> Preferenze → Privacy → Gestisci dati siti web</li>
              <li><strong>Edge:</strong> Impostazioni → Cookie e autorizzazioni sito</li>
            </ul>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">4.2 Banner dei Cookie</h3>
            <p className="mb-4">
              Al primo accesso al sito, viene mostrato un banner informativo che permette di:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Accettare tutti i cookie</li>
              <li>Rifiutare i cookie non necessari</li>
              <li>Personalizzare le preferenze per categoria</li>
              <li>Consultare maggiori informazioni</li>
            </ul>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">4.3 Revoca del Consenso</h3>
            <p className="mb-4">
              È possibile modificare o revocare il consenso in qualsiasi momento:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Attraverso le impostazioni del proprio account</li>
              <li>Contattando il supporto: <strong>privacy@amicosegreto.it</strong></li>
              <li>Utilizzando le impostazioni del browser per eliminare i cookie esistenti</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. Conseguenze della Disabilitazione</h2>
          <p className="mb-4">
            La disabilitazione dei cookie può comportare:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li><strong>Cookie tecnici:</strong> impossibilità di utilizzare alcune funzionalità del sito</li>
            <li><strong>Cookie analitici:</strong> nessun impatto sul funzionamento del sito</li>
            <li><strong>Disconnessione automatica:</strong> per i cookie di autenticazione</li>
            <li><strong>Perdita di preferenze:</strong> per i cookie di personalizzazione</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">6. Cookie di Terze Parti - Link Utili</h2>
          <div className="mb-4">
            <p className="mb-2"><strong>Google Analytics:</strong></p>
            <ul className="list-disc pl-6 mb-4 space-y-1 text-sm">
              <li>Informativa: <a href="https://policies.google.com/privacy" className="text-primary underline" target="_blank" rel="noopener noreferrer">https://policies.google.com/privacy</a></li>
              <li>Opt-out: <a href="https://tools.google.com/dlpage/gaoptout" className="text-primary underline" target="_blank" rel="noopener noreferrer">https://tools.google.com/dlpage/gaoptout</a></li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">7. Aggiornamenti</h2>
          <p className="mb-4">
            La presente Cookie Policy può essere modificata periodicamente per riflettere 
            cambiamenti nelle nostre pratiche sui cookie o per motivi legali, normativi o operativi.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">8. Contatti</h2>
          <p className="mb-4">
            Per domande riguardanti questa Cookie Policy, contattare:
          </p>
          <p>
            <strong>Email:</strong> privacy@amicosegreto.it<br />
            <strong>Oggetto:</strong> Cookie Policy - Richiesta informazioni
          </p>
        </section>
      </div>
    </div>
  );
}

