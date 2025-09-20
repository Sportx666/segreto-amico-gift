export default function Terms() {
  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Termini e Condizioni</h1>
      
      <div className="prose prose-gray max-w-none space-y-8">
        <section>
          <p className="text-muted-foreground mb-6">
            I presenti Termini e Condizioni regolano l&apos;utilizzo del servizio Amico Segreto e costituiscono 
            un contratto vincolante tra l&apos;utente e il fornitore del servizio.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">1. Accettazione dei Termini</h2>
          <p className="mb-4">
            Utilizzando il servizio Amico Segreto, l&apos;utente accetta integralmente i presenti 
            Termini e Condizioni. Se non si accettano questi termini, non utilizzare il servizio.
          </p>
          <p className="mb-4">
            L&apos;accettazione può avvenire mediante:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>Registrazione di un account utente</li>
            <li>Utilizzo delle funzionalità del servizio</li>
            <li>Accesso continuato al sito web</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">2. Descrizione del Servizio</h2>
          <p className="mb-4">
            Amico Segreto è una piattaforma digitale che permette di organizzare e gestire 
            eventi di scambio regali tra amici, familiari o colleghi. Il servizio include:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>Creazione e gestione di eventi</li>
            <li>Invito e coordinamento dei partecipanti</li>
            <li>Sorteggio automatico degli abbinamenti</li>
            <li>Gestione delle liste desideri</li>
            <li>Sistema di messaggistica tra partecipanti</li>
            <li>Suggerimenti per regali attraverso partner commerciali</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. Registrazione e Account</h2>
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">3.1 Requisiti per la Registrazione</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Età minima di 13 anni (i minori necessitano del consenso dei genitori)</li>
              <li>Fornire informazioni accurate e complete</li>
              <li>Mantenere aggiornate le informazioni del proprio account</li>
              <li>Non creare account multipli per la stessa persona</li>
            </ul>
          </div>
          
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">3.2 Sicurezza dell&apos;Account</h3>
            <p className="mb-4">L&apos;utente è responsabile di:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Mantenere riservate le credenziali di accesso</li>
              <li>Notificare immediatamente accessi non autorizzati</li>
              <li>Utilizzare password sicure e uniche</li>
              <li>Non condividere l&apos;account con terzi</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. Utilizzo del Servizio</h2>
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">4.1 Uso Consentito</h3>
            <p className="mb-4">Il servizio può essere utilizzato esclusivamente per:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Organizzare eventi di scambio regali leciti</li>
              <li>Partecipare ad eventi a cui si è stati invitati</li>
              <li>Comunicare con altri partecipanti nel rispetto delle regole</li>
              <li>Utilizzare le funzionalità come previsto dal servizio</li>
            </ul>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">4.2 Comportamenti Vietati</h3>
            <p className="mb-4">È espressamente vietato:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Utilizzare il servizio per scopi commerciali non autorizzati</li>
              <li>Molestare, intimidire o danneggiare altri utenti</li>
              <li>Condividere contenuti illegali, offensivi o inappropriati</li>
              <li>Tentare di compromettere la sicurezza del sistema</li>
              <li>Utilizzare bot, script automatici o strumenti non autorizzati</li>
              <li>Violare i diritti di proprietà intellettuale</li>
              <li>Creare eventi falsi o ingannevoli</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. Contenuti Utente</h2>
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">5.1 Responsabilità dei Contenuti</h3>
            <p className="mb-4">
              L&apos;utente è l&apos;unico responsabile di tutti i contenuti che pubblica, condivide 
              o trasmette attraverso il servizio, inclusi testi, immagini, liste desideri e messaggi.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">5.2 Licenza d&apos;Uso</h3>
            <p className="mb-4">
              Pubblicando contenuti sul servizio, l&apos;utente concede una licenza non esclusiva, 
              gratuita e mondiale per utilizzare, modificare, riprodurre e distribuire tali contenuti 
              esclusivamente per il funzionamento del servizio.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">5.3 Rimozione dei Contenuti</h3>
            <p className="mb-4">
              Ci riserviamo il diritto di rimuovere contenuti che violano questi termini o 
              che riteniamo inappropriati, senza preavviso.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">6. Privacy e Dati Personali</h2>
          <p className="mb-4">
            Il trattamento dei dati personali è disciplinato dalla nostra 
            <a href="/privacy" className="text-primary underline">Informativa sulla Privacy</a>, 
            che costituisce parte integrante di questi Termini e Condizioni.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">7. Proprietà Intellettuale</h2>
          <p className="mb-4">
            Tutti i diritti di proprietà intellettuale relativi al servizio Amico Segreto, 
            inclusi ma non limitati a marchi, loghi, design, codice sorgente e contenuti, 
            sono di proprietà esclusiva del fornitore del servizio o dei rispettivi proprietari.
          </p>
          <p className="mb-4">
            È vietato copiare, modificare, distribuire o utilizzare commercialmente 
            qualsiasi elemento protetto da diritti di proprietà intellettuale senza autorizzazione scritta.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">8. Limitazioni di Responsabilità</h2>
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">8.1 Disponibilità del Servizio</h3>
            <p className="mb-4">
              Il servizio è fornito &quot;così com&apos;è&quot; senza garanzie di alcun tipo. 
              Non garantiamo che il servizio sia sempre disponibile, privo di errori o interruzioni.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">8.2 Esclusione di Responsabilità</h3>
            <p className="mb-4">Non siamo responsabili per:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Danni derivanti dall&apos;utilizzo o dall&apos;impossibilità di utilizzare il servizio</li>
              <li>Comportamenti di altri utenti o contenuti da essi pubblicati</li>
              <li>Perdita di dati o interruzioni del servizio</li>
              <li>Danni indiretti, consequenziali o punitivi</li>
              <li>Transazioni tra utenti o con terze parti</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">9. Sospensione e Risoluzione</h2>
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">9.1 Sospensione dell&apos;Account</h3>
            <p className="mb-4">
              Possiamo sospendere o disattivare l&apos;account in caso di violazione di questi termini, 
              comportamenti inappropriati o per motivi di sicurezza.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">9.2 Risoluzione da Parte dell&apos;Utente</h3>
            <p className="mb-4">
              L&apos;utente può cessare l&apos;utilizzo del servizio e cancellare il proprio account 
              in qualsiasi momento attraverso le impostazioni del profilo.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">10. Modifiche ai Termini</h2>
          <p className="mb-4">
            Ci riserviamo il diritto di modificare questi Termini e Condizioni in qualsiasi momento. 
            Le modifiche sostanziali saranno comunicate agli utenti tramite:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>Notifica via email</li>
            <li>Avviso sul sito web</li>
            <li>Notifica nell&apos;applicazione</li>
          </ul>
          <p className="mb-4">
            L&apos;utilizzo continuato del servizio dopo la pubblicazione delle modifiche 
            costituisce accettazione dei nuovi termini.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">11. Legge Applicabile e Foro Competente</h2>
          <p className="mb-4">
            I presenti Termini e Condizioni sono regolati dalla legge italiana. 
            Per qualsiasi controversia sarà competente esclusivamente il Foro di [Città], Italia.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">12. Disposizioni Generali</h2>
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">12.1 Separabilità</h3>
            <p className="mb-4">
              Se una disposizione di questi termini dovesse risultare invalida o inapplicabile, 
              le restanti disposizioni rimarranno in vigore.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">12.2 Intero Accordo</h3>
            <p className="mb-4">
              Questi Termini e Condizioni, insieme all&apos;Informativa sulla Privacy, 
              costituiscono l&apos;intero accordo tra l&apos;utente e il fornitore del servizio.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">13. Contatti</h2>
          <p className="mb-4">
            Per domande riguardanti questi Termini e Condizioni, contattare:
          </p>
          <p>
            <strong>Email:</strong> legal@amicosegreto.it<br />
            <strong>Indirizzo:</strong> [Inserire indirizzo completo]<br />
            <strong>Oggetto:</strong> Termini e Condizioni - Richiesta informazioni
          </p>
        </section>
      </div>
    </div>
  );
}

