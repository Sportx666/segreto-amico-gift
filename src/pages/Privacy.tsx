export default function Privacy() {
  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Informativa sulla Privacy</h1>
      
      <div className="prose prose-gray max-w-none space-y-8">
        <section>
          <p className="text-muted-foreground mb-6">
            La presente informativa descrive le modalità di trattamento dei dati personali degli utenti che consultano il nostro sito web.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">1. Titolare del Trattamento</h2>
          <p className="mb-4">
            Il Titolare del trattamento dei dati personali è Amico Segreto, con sede in Italia.
          </p>
          <p className="mb-4">
            <strong>Contatti:</strong><br />
            Email: privacy@amicosegreto.it<br />
            Indirizzo: [Inserire indirizzo completo]
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">2. Tipi di Dati Raccolti</h2>
          <p className="mb-4">
            I dati personali raccolti da questo sito, in via automatica o volontariamente forniti dall&apos;utente, includono:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li><strong>Dati di registrazione:</strong> nome, cognome, indirizzo email</li>
            <li><strong>Dati di profilo:</strong> nickname, avatar, informazioni personali facoltative</li>
            <li><strong>Dati di utilizzo:</strong> indirizzo IP, tipo di browser, pagine visitate, tempo di permanenza</li>
            <li><strong>Cookie e tecnologie simili:</strong> per il funzionamento del sito e l&apos;analisi del traffico</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. Finalità del Trattamento</h2>
          <p className="mb-4">I dati personali sono trattati per le seguenti finalità:</p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li><strong>Erogazione del servizio:</strong> gestione degli eventi Amico Segreto, comunicazioni tra partecipanti</li>
            <li><strong>Autenticazione:</strong> verifica dell&apos;identità e accesso al proprio account</li>
            <li><strong>Comunicazioni:</strong> invio di notifiche relative agli eventi e aggiornamenti del servizio</li>
            <li><strong>Miglioramento del servizio:</strong> analisi statistiche anonime per ottimizzare l&apos;esperienza utente</li>
            <li><strong>Adempimenti legali:</strong> rispetto degli obblighi di legge</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. Base Giuridica del Trattamento</h2>
          <p className="mb-4">Il trattamento è basato su:</p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li><strong>Consenso:</strong> per l&apos;uso di cookie non essenziali e comunicazioni promozionali</li>
            <li><strong>Esecuzione del contratto:</strong> per l&apos;erogazione del servizio richiesto</li>
            <li><strong>Interesse legittimo:</strong> per il miglioramento del servizio e la sicurezza</li>
            <li><strong>Obbligo legale:</strong> per il rispetto di norme di legge</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. Modalità di Trattamento</h2>
          <p className="mb-4">
            I dati sono trattati con strumenti informatici e/o telematici, con modalità organizzative 
            e logiche strettamente correlate alle finalità indicate. Oltre al Titolare, possono accedere 
            ai dati alcune categorie di incaricati coinvolti nell&apos;organizzazione del sito o soggetti esterni.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">6. Conservazione dei Dati</h2>
          <p className="mb-4">
            I dati personali sono conservati per il tempo necessario al conseguimento delle finalità 
            per le quali sono stati raccolti:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li><strong>Account utente:</strong> fino alla cancellazione dell&apos;account da parte dell&apos;utente</li>
            <li><strong>Dati di utilizzo:</strong> generalmente non oltre 26 mesi</li>
            <li><strong>Cookie:</strong> secondo le tempistiche specificate nella Cookie Policy</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">7. Condivisione dei Dati</h2>
          <p className="mb-4">
            I dati possono essere comunicati a:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li><strong>Fornitori di servizi:</strong> per l&apos;hosting, l&apos;invio di email, l&apos;analisi dei dati</li>
            <li><strong>Autorità competenti:</strong> quando richiesto dalla legge</li>
            <li><strong>Altri partecipanti:</strong> limitatamente alle informazioni necessarie per il gioco (nome/nickname)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">8. Trasferimento dei Dati</h2>
          <p className="mb-4">
            I dati possono essere trasferiti in paesi dell&apos;Unione Europea o in paesi terzi. 
            In caso di trasferimento verso paesi terzi, vengono adottate adeguate garanzie 
            per la protezione dei dati personali.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">9. Diritti dell&apos;Interessato</h2>
          <p className="mb-4">
            L&apos;utente ha il diritto di:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li><strong>Accesso:</strong> ottenere informazioni sui propri dati trattati</li>
            <li><strong>Rettifica:</strong> correggere dati inesatti o incompleti</li>
            <li><strong>Cancellazione:</strong> richiedere la cancellazione dei propri dati</li>
            <li><strong>Limitazione:</strong> limitare il trattamento in determinate circostanze</li>
            <li><strong>Portabilità:</strong> ricevere i dati in formato strutturato</li>
            <li><strong>Opposizione:</strong> opporsi al trattamento per motivi legittimi</li>
            <li><strong>Revoca del consenso:</strong> revocare il consenso in qualsiasi momento</li>
          </ul>
          <p className="mb-4">
            Per esercitare questi diritti, contattare: <strong>privacy@amicosegreto.it</strong>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">10. Sicurezza dei Dati</h2>
          <p className="mb-4">
            Sono adottate misure tecniche e organizzative appropriate per garantire un livello 
            di sicurezza adeguato ai rischi, incluse la cifratura dei dati, l&apos;accesso controllato 
            e il monitoraggio delle attività.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">11. Reclami</h2>
          <p className="mb-4">
            L&apos;utente ha il diritto di presentare reclamo all&apos;Autorità Garante per la protezione 
            dei dati personali (www.gpdp.it) se ritiene che il trattamento violi la normativa vigente.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">12. Modifiche</h2>
          <p className="mb-4">
            La presente informativa può essere modificata periodicamente. Le modifiche sostanziali 
            saranno comunicate agli utenti tramite avviso sul sito web.
          </p>
        </section>
      </div>
    </div>
  );
}

