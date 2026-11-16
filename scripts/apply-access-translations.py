import re, sys

# Pass the folder database/seeders/Translations of the API as first argument to append the keys to its four seeders.
DIR = (sys.argv[1].rstrip('/') + '/') if len(sys.argv) > 1 else None

# key -> (it, en, de, fr)
T = {}

def add(key, it, en, de, fr):
    T[key] = (it, en, de, fr)

add('NAV.ACCESS_ROLES', 'Ruoli personalizzati', 'Custom roles', 'Eigene Rollen', 'Rôles personnalisés')
add('NAV.ACCESS_TEAMS', 'Team', 'Teams', 'Teams', 'Équipes')
add('NAV.ACCESS_AUDIT', 'Storico accessi', 'Access history', 'Zugriffsverlauf', 'Historique des accès')

# navigation between pages
add('access.nav.label', 'Gestione utenti e accessi', 'User and access management', 'Benutzer- und Zugriffsverwaltung', 'Gestion des utilisateurs et des accès')
add('access.nav.members', 'Utenti', 'Members', 'Benutzer', 'Utilisateurs')
add('access.nav.invitations', 'Inviti', 'Invitations', 'Einladungen', 'Invitations')
add('access.nav.import', 'Importa da CSV', 'Import from CSV', 'CSV-Import', 'Importer depuis un CSV')
add('access.nav.roles', 'Ruoli', 'Roles', 'Rollen', 'Rôles')
add('access.nav.teams', 'Team', 'Teams', 'Teams', 'Équipes')
add('access.nav.delegations', 'Deleghe', 'Delegations', 'Vertretungen', 'Délégations')
add('access.nav.matrix', 'Matrice permessi', 'Permission matrix', 'Berechtigungsmatrix', 'Matrice des permissions')
add('access.nav.audit', 'Storico modifiche', 'Change history', 'Änderungsverlauf', 'Historique des modifications')

add('access.errors.conflict', 'L\'operazione non è possibile nello stato attuale.', 'The operation is not possible in the current state.', 'Der Vorgang ist im aktuellen Zustand nicht möglich.', 'L\'opération n\'est pas possible dans l\'état actuel.')

# plan limits
add('access.limits.plan', 'Piano', 'Plan', 'Tarif', 'Forfait')
add('access.limits.users', 'Utenti (attivi e inviti in attesa)', 'Users (active and pending invitations)', 'Benutzer (aktiv und offene Einladungen)', 'Utilisateurs (actifs et invitations en attente)')
add('access.limits.customRoles', 'Ruoli personalizzati', 'Custom roles', 'Eigene Rollen', 'Rôles personnalisés')
add('access.limits.unlimited', 'illimitati', 'unlimited', 'unbegrenzt', 'illimité')
add('access.limits.pending', 'Inviti in attesa: {count}', 'Pending invitations: {count}', 'Offene Einladungen: {count}', 'Invitations en attente : {count}')

# members page
add('access.members.invite', 'Invita via email', 'Invite by email', 'Per E-Mail einladen', 'Inviter par e-mail')
add('access.members.import', 'Importa da CSV', 'Import from CSV', 'CSV-Import', 'Importer depuis un CSV')
add('access.members.suspend', 'Disattiva', 'Deactivate', 'Deaktivieren', 'Désactiver')
add('access.members.reactivate', 'Riattiva', 'Reactivate', 'Reaktivieren', 'Réactiver')
add('access.members.confirmSuspend', 'Disattivare l\'accesso di questa persona? Potrai riattivarlo in qualsiasi momento.', 'Deactivate this person\'s access? You can reactivate it at any time.', 'Den Zugang dieser Person deaktivieren? Er kann jederzeit reaktiviert werden.', 'Désactiver l\'accès de cette personne ? Vous pourrez le réactiver à tout moment.')
add('access.members.suspended', 'Accesso disattivato', 'Access deactivated', 'Zugang deaktiviert', 'Accès désactivé')
add('access.members.reactivated', 'Accesso riattivato', 'Access reactivated', 'Zugang reaktiviert', 'Accès réactivé')

# invitations
add('access.invitations.title', 'Inviti', 'Invitations', 'Einladungen', 'Invitations')
add('access.invitations.subtitle', 'Invita per email chi non ha ancora accesso: riceverà un link per unirsi all\'azienda', 'Invite people by email: they receive a link to join the company', 'Laden Sie Personen per E-Mail ein: Sie erhalten einen Link, um dem Unternehmen beizutreten', 'Invitez des personnes par e-mail : elles reçoivent un lien pour rejoindre l\'entreprise')
add('access.invitations.invite', 'Invita una persona', 'Invite a person', 'Person einladen', 'Inviter une personne')
add('access.invitations.send', 'Invia invito', 'Send invitation', 'Einladung senden', 'Envoyer l\'invitation')
add('access.invitations.sent', 'Invito inviato', 'Invitation sent', 'Einladung gesendet', 'Invitation envoyée')
add('access.invitations.resend', 'Invia di nuovo', 'Send again', 'Erneut senden', 'Renvoyer')
add('access.invitations.resent', 'Invito inviato di nuovo', 'Invitation sent again', 'Einladung erneut gesendet', 'Invitation renvoyée')
add('access.invitations.revoke', 'Revoca', 'Revoke', 'Widerrufen', 'Révoquer')
add('access.invitations.revoked', 'Invito revocato', 'Invitation revoked', 'Einladung widerrufen', 'Invitation révoquée')
add('access.invitations.confirmRevoke', 'Revocare l\'invito? Il link non funzionerà più.', 'Revoke the invitation? The link will stop working.', 'Einladung widerrufen? Der Link funktioniert dann nicht mehr.', 'Révoquer l\'invitation ? Le lien ne fonctionnera plus.')
add('access.invitations.status', 'Stato', 'Status', 'Status', 'Statut')
add('access.invitations.expiresAt', 'Scade il', 'Expires on', 'Läuft ab am', 'Expire le')
add('access.invitations.teams', 'Team', 'Teams', 'Teams', 'Équipes')
add('access.invitations.empty', 'Nessun invito', 'No invitations', 'Keine Einladungen', 'Aucune invitation')
add('access.invitations.statuses.pending', 'In attesa', 'Pending', 'Offen', 'En attente')
add('access.invitations.statuses.accepted', 'Accettato', 'Accepted', 'Angenommen', 'Accepté')
add('access.invitations.statuses.revoked', 'Revocato', 'Revoked', 'Widerrufen', 'Révoqué')
add('access.invitations.statuses.expired', 'Scaduto', 'Expired', 'Abgelaufen', 'Expiré')

# custom roles
add('access.roles.title', 'Ruoli personalizzati', 'Custom roles', 'Eigene Rollen', 'Rôles personnalisés')
add('access.roles.subtitle', 'Crea ruoli su misura: parti da un ruolo di sistema e scegli il livello per ogni modulo', 'Create tailored roles: start from a system role and choose the level of every module', 'Erstellen Sie maßgeschneiderte Rollen: Ausgehend von einer Systemrolle legen Sie die Stufe jedes Moduls fest', 'Créez des rôles sur mesure : partez d\'un rôle système et choisissez le niveau de chaque module')
add('access.roles.add', 'Nuovo ruolo', 'New role', 'Neue Rolle', 'Nouveau rôle')
add('access.roles.addTitle', 'Nuovo ruolo personalizzato', 'New custom role', 'Neue eigene Rolle', 'Nouveau rôle personnalisé')
add('access.roles.editTitle', 'Modifica ruolo', 'Edit role', 'Rolle bearbeiten', 'Modifier le rôle')
add('access.roles.name', 'Nome', 'Name', 'Name', 'Nom')
add('access.roles.description', 'Descrizione', 'Description', 'Beschreibung', 'Description')
add('access.roles.baseRole', 'Ruolo di base', 'Base role', 'Basisrolle', 'Rôle de base')
add('access.roles.baseRoleHint', 'Il ruolo di sistema da cui parte l\'accesso ai moduli', 'The system role the access to modules starts from', 'Die Systemrolle, von der der Zugriff auf die Module ausgeht', 'Le rôle système dont part l\'accès aux modules')
add('access.roles.modulesHint', 'Per ogni modulo: come il ruolo di base, bloccato, sola lettura o scrittura. Le modifiche valgono per chi ha già questo ruolo.', 'For every module: as the base role, blocked, read only or write. Changes apply to everyone who already holds this role.', 'Für jedes Modul: wie die Basisrolle, gesperrt, nur lesen oder schreiben. Änderungen gelten für alle, die diese Rolle bereits haben.', 'Pour chaque module : comme le rôle de base, bloqué, lecture seule ou écriture. Les modifications s\'appliquent à tous ceux qui ont déjà ce rôle.')
add('access.roles.members', 'Utenti', 'Members', 'Benutzer', 'Utilisateurs')
add('access.roles.saved', 'Ruolo salvato', 'Role saved', 'Rolle gespeichert', 'Rôle enregistré')
add('access.roles.deleted', 'Ruolo eliminato', 'Role deleted', 'Rolle gelöscht', 'Rôle supprimé')
add('access.roles.confirmDelete', 'Eliminare il ruolo? Non si può eliminare se è assegnato a qualcuno.', 'Delete the role? It cannot be deleted while someone holds it.', 'Rolle löschen? Sie kann nicht gelöscht werden, solange sie jemandem zugewiesen ist.', 'Supprimer le rôle ? Il ne peut pas être supprimé tant qu\'il est attribué à quelqu\'un.')
add('access.roles.empty', 'Nessun ruolo personalizzato', 'No custom roles', 'Keine eigenen Rollen', 'Aucun rôle personnalisé')

# matrix
add('access.matrix.title', 'Matrice dei permessi', 'Permission matrix', 'Berechtigungsmatrix', 'Matrice des permissions')
add('access.matrix.subtitle', 'Chi può leggere e chi può scrivere in ogni modulo, per ruolo (sola consultazione)', 'Who can read and who can write in every module, by role (read only)', 'Wer in jedem Modul lesen und schreiben darf, nach Rolle (nur Ansicht)', 'Qui peut lire et qui peut écrire dans chaque module, par rôle (consultation seule)')
add('access.matrix.role', 'Ruolo', 'Role', 'Rolle', 'Rôle')
add('access.matrix.custom', 'Personalizzato', 'Custom', 'Eigen', 'Personnalisé')
add('access.matrix.read', 'Lettura', 'Read', 'Lesen', 'Lecture')
add('access.matrix.write', 'Lettura e scrittura', 'Read and write', 'Lesen und schreiben', 'Lecture et écriture')
add('access.matrix.none', 'Nessun accesso', 'No access', 'Kein Zugriff', 'Aucun accès')
add('access.matrix.legend', 'R = lettura, R W = lettura e scrittura, - = nessun accesso', 'R = read, R W = read and write, - = no access', 'R = lesen, R W = lesen und schreiben, - = kein Zugriff', 'R = lecture, R W = lecture et écriture, - = aucun accès')

# teams
add('access.teams.title', 'Team', 'Teams', 'Teams', 'Équipes')
add('access.teams.subtitle', 'Raggruppa le persone e, se vuoi, dai al team un ruolo personalizzato', 'Group people and, if you like, give the team a custom role', 'Fassen Sie Personen zusammen und geben Sie dem Team bei Bedarf eine eigene Rolle', 'Regroupez des personnes et, si vous le souhaitez, donnez à l\'équipe un rôle personnalisé')
add('access.teams.add', 'Nuovo team', 'New team', 'Neues Team', 'Nouvelle équipe')
add('access.teams.addTitle', 'Nuovo team', 'New team', 'Neues Team', 'Nouvelle équipe')
add('access.teams.editTitle', 'Modifica team', 'Edit team', 'Team bearbeiten', 'Modifier l\'équipe')
add('access.teams.name', 'Nome del team', 'Team name', 'Teamname', 'Nom de l\'équipe')
add('access.teams.role', 'Ruolo personalizzato', 'Custom role', 'Eigene Rolle', 'Rôle personnalisé')
add('access.teams.noRole', 'Nessun ruolo', 'No role', 'Keine Rolle', 'Aucun rôle')
add('access.teams.members', 'Membri', 'Members', 'Mitglieder', 'Membres')
add('access.teams.saved', 'Team salvato', 'Team saved', 'Team gespeichert', 'Équipe enregistrée')
add('access.teams.deleted', 'Team eliminato', 'Team deleted', 'Team gelöscht', 'Équipe supprimée')
add('access.teams.confirmDelete', 'Eliminare il team? Le persone restano nell\'azienda.', 'Delete the team? The people stay in the company.', 'Team löschen? Die Personen bleiben im Unternehmen.', 'Supprimer l\'équipe ? Les personnes restent dans l\'entreprise.')
add('access.teams.empty', 'Nessun team', 'No teams', 'Keine Teams', 'Aucune équipe')

# delegations
add('access.delegations.title', 'Deleghe temporanee', 'Temporary delegations', 'Befristete Vertretungen', 'Délégations temporaires')
add('access.delegations.subtitle', 'Per un periodo, una persona agisce con i permessi di un\'altra (ferie, assenze)', 'For a period, a person acts with the permissions of another one (holidays, absences)', 'Für einen Zeitraum handelt eine Person mit den Berechtigungen einer anderen (Urlaub, Abwesenheit)', 'Pendant une période, une personne agit avec les permissions d\'une autre (congés, absences)')
add('access.delegations.add', 'Nuova delega', 'New delegation', 'Neue Vertretung', 'Nouvelle délégation')
add('access.delegations.create', 'Crea delega', 'Create delegation', 'Vertretung anlegen', 'Créer la délégation')
add('access.delegations.delegator', 'Delegante', 'Delegator', 'Vertretener', 'Délégant')
add('access.delegations.delegate', 'Delegato', 'Delegate', 'Vertreter', 'Délégué')
add('access.delegations.period', 'Periodo', 'Period', 'Zeitraum', 'Période')
add('access.delegations.startsAt', 'Dal', 'From', 'Von', 'Du')
add('access.delegations.endsAt', 'Al', 'Until', 'Bis', 'Au')
add('access.delegations.scope', 'Moduli', 'Modules', 'Module', 'Modules')
add('access.delegations.modules', 'Limita ai moduli', 'Limit to modules', 'Auf Module beschränken', 'Limiter aux modules')
add('access.delegations.modulesHint', 'Lascia vuoto per delegare tutti i moduli del delegante', 'Leave empty to delegate every module of the delegator', 'Leer lassen, um alle Module des Vertretenen zu übertragen', 'Laissez vide pour déléguer tous les modules du délégant')
add('access.delegations.allModules', 'Tutti', 'All', 'Alle', 'Tous')
add('access.delegations.reason', 'Motivo', 'Reason', 'Grund', 'Motif')
add('access.delegations.saved', 'Delega creata', 'Delegation created', 'Vertretung angelegt', 'Délégation créée')
add('access.delegations.revoked', 'Delega revocata', 'Delegation revoked', 'Vertretung widerrufen', 'Délégation révoquée')
add('access.delegations.confirmRevoke', 'Revocare la delega? Ha effetto subito.', 'Revoke the delegation? It takes effect immediately.', 'Vertretung widerrufen? Dies wirkt sofort.', 'Révoquer la délégation ? Elle prend effet immédiatement.')
add('access.delegations.empty', 'Nessuna delega', 'No delegations', 'Keine Vertretungen', 'Aucune délégation')
add('access.delegations.statuses.active', 'Attiva', 'Active', 'Aktiv', 'Active')
add('access.delegations.statuses.scheduled', 'Programmata', 'Scheduled', 'Geplant', 'Planifiée')
add('access.delegations.statuses.expired', 'Scaduta', 'Expired', 'Abgelaufen', 'Expirée')
add('access.delegations.statuses.revoked', 'Revocata', 'Revoked', 'Widerrufen', 'Révoquée')

# audit
add('access.audit.title', 'Storico delle modifiche', 'Change history', 'Änderungsverlauf', 'Historique des modifications')
add('access.audit.subtitle', 'Chi ha cambiato utenti, ruoli, team, deleghe e inviti, e quando', 'Who changed users, roles, teams, delegations and invitations, and when', 'Wer wann Benutzer, Rollen, Teams, Vertretungen und Einladungen geändert hat', 'Qui a modifié les utilisateurs, rôles, équipes, délégations et invitations, et quand')
add('access.audit.allTypes', 'Tutti i tipi', 'All types', 'Alle Typen', 'Tous les types')
add('access.audit.when', 'Quando', 'When', 'Wann', 'Quand')
add('access.audit.type', 'Tipo', 'Type', 'Typ', 'Type')
add('access.audit.event', 'Evento', 'Event', 'Ereignis', 'Événement')
add('access.audit.actor', 'Eseguito da', 'Done by', 'Durchgeführt von', 'Effectué par')
add('access.audit.details', 'Dettagli', 'Details', 'Details', 'Détails')
add('access.audit.empty', 'Nessuna modifica registrata', 'No changes recorded', 'Keine Änderungen aufgezeichnet', 'Aucune modification enregistrée')
add('access.audit.types.access.member', 'Utenti', 'Members', 'Benutzer', 'Utilisateurs')
add('access.audit.types.access.role', 'Ruoli', 'Roles', 'Rollen', 'Rôles')
add('access.audit.types.access.team', 'Team', 'Teams', 'Teams', 'Équipes')
add('access.audit.types.access.delegation', 'Deleghe', 'Delegations', 'Vertretungen', 'Délégations')
add('access.audit.types.access.invitation', 'Inviti', 'Invitations', 'Einladungen', 'Invitations')
add('access.audit.types.access.import', 'Importazioni', 'Imports', 'Importe', 'Importations')
add('access.audit.types.access.plan', 'Piano', 'Plan', 'Tarif', 'Forfait')

# CSV import
add('access.import.title', 'Importa utenti da CSV', 'Import users from CSV', 'Benutzer aus CSV importieren', 'Importer des utilisateurs depuis un CSV')
add('access.import.subtitle', 'Aggiungi molte persone in una volta: prima controlla il file, poi conferma', 'Add many people at once: check the file first, then confirm', 'Fügen Sie viele Personen auf einmal hinzu: erst die Datei prüfen, dann bestätigen', 'Ajoutez de nombreuses personnes à la fois : vérifiez d\'abord le fichier, puis confirmez')
add('access.import.help', 'Il file CSV (max 2 MB) ha le colonne email;name;role;team. Solo l\'email è obbligatoria; più team si separano con |. Chi non ha ancora un account riceve un invito.', 'The CSV file (max 2 MB) has the columns email;name;role;team. Only the email is required; separate several teams with |. People without an account receive an invitation.', 'Die CSV-Datei (max. 2 MB) hat die Spalten email;name;role;team. Nur die E-Mail ist Pflicht; mehrere Teams werden mit | getrennt. Personen ohne Konto erhalten eine Einladung.', 'Le fichier CSV (2 Mo max) a les colonnes email;name;role;team. Seul l\'e-mail est obligatoire ; séparez plusieurs équipes par |. Les personnes sans compte reçoivent une invitation.')
add('access.import.template', 'Scarica il modello CSV', 'Download the CSV template', 'CSV-Vorlage herunterladen', 'Télécharger le modèle CSV')
add('access.import.file', 'File CSV', 'CSV file', 'CSV-Datei', 'Fichier CSV')
add('access.import.defaultRole', 'Ruolo per le righe senza ruolo', 'Role for rows without a role', 'Rolle für Zeilen ohne Rolle', 'Rôle pour les lignes sans rôle')
add('access.import.check', 'Solo controllo', 'Check only', 'Nur prüfen', 'Vérifier seulement')
add('access.import.confirm', 'Conferma importazione', 'Confirm import', 'Import bestätigen', 'Confirmer l\'importation')
add('access.import.dryRunDone', 'Controllo completato: non è stato modificato nulla', 'Check completed: nothing has been changed', 'Prüfung abgeschlossen: es wurde nichts geändert', 'Vérification terminée : rien n\'a été modifié')
add('access.import.done', 'Importazione completata', 'Import completed', 'Import abgeschlossen', 'Importation terminée')
add('access.import.summary', 'Righe: {total}. Aggiunti: {created}. Invitati: {invited}. Saltati: {skipped}. Errori: {errors}.', 'Rows: {total}. Added: {created}. Invited: {invited}. Skipped: {skipped}. Errors: {errors}.', 'Zeilen: {total}. Hinzugefügt: {created}. Eingeladen: {invited}. Übersprungen: {skipped}. Fehler: {errors}.', 'Lignes : {total}. Ajoutés : {created}. Invités : {invited}. Ignorés : {skipped}. Erreurs : {errors}.')
add('access.import.line', 'Riga', 'Line', 'Zeile', 'Ligne')
add('access.import.message', 'Nota', 'Note', 'Hinweis', 'Remarque')
add('access.import.statuses.created', 'Aggiunto', 'Added', 'Hinzugefügt', 'Ajouté')
add('access.import.statuses.invited', 'Invitato', 'Invited', 'Eingeladen', 'Invité')
add('access.import.statuses.would_add', 'Verrà aggiunto', 'Would be added', 'Würde hinzugefügt', 'Serait ajouté')
add('access.import.statuses.would_invite', 'Verrà invitato', 'Would be invited', 'Würde eingeladen', 'Serait invité')
add('access.import.statuses.skipped', 'Saltato', 'Skipped', 'Übersprungen', 'Ignoré')
add('access.import.statuses.error', 'Errore', 'Error', 'Fehler', 'Erreur')

# public page
add('access.accept.title', 'Invito all\'azienda', 'Company invitation', 'Einladung zum Unternehmen', 'Invitation à l\'entreprise')
add('access.accept.checking', 'Controllo dell\'invito...', 'Checking the invitation...', 'Einladung wird geprüft...', 'Vérification de l\'invitation...')
add('access.accept.summary', 'Sei stato invitato a unirti a {company} con l\'indirizzo {email}.', 'You have been invited to join {company} with the address {email}.', 'Sie wurden eingeladen, {company} mit der Adresse {email} beizutreten.', 'Vous avez été invité à rejoindre {company} avec l\'adresse {email}.')
add('access.accept.invalidTitle', 'Invito non valido', 'Invitation not valid', 'Einladung ungültig', 'Invitation non valide')
add('access.accept.invalidBody', 'Il link non è valido, è scaduto o è stato revocato. Chiedi a chi ti ha invitato di inviarne uno nuovo.', 'The link is not valid, has expired or was revoked. Ask the person who invited you to send a new one.', 'Der Link ist ungültig, abgelaufen oder wurde widerrufen. Bitten Sie die einladende Person, einen neuen zu senden.', 'Le lien n\'est pas valide, a expiré ou a été révoqué. Demandez à la personne qui vous a invité d\'en envoyer un nouveau.')
add('access.accept.failed', 'Non è stato possibile accettare l\'invito. Riprova più tardi.', 'The invitation could not be accepted. Try again later.', 'Die Einladung konnte nicht angenommen werden. Versuchen Sie es später erneut.', 'L\'invitation n\'a pas pu être acceptée. Réessayez plus tard.')
add('access.accept.name', 'Nome e cognome', 'Full name', 'Vor- und Nachname', 'Nom et prénom')
add('access.accept.createAccount', 'Crea l\'account e accetta', 'Create the account and accept', 'Konto erstellen und annehmen', 'Créer le compte et accepter')
add('access.accept.accept', 'Accetta l\'invito', 'Accept the invitation', 'Einladung annehmen', 'Accepter l\'invitation')
add('access.accept.signInFirst', 'Hai già un account con questo indirizzo: accedi prima, poi torna a questo link per accettare.', 'You already have an account with this address: sign in first, then come back to this link to accept.', 'Sie haben bereits ein Konto mit dieser Adresse: Melden Sie sich zuerst an und öffnen Sie dann diesen Link erneut, um anzunehmen.', 'Vous avez déjà un compte avec cette adresse : connectez-vous d\'abord, puis revenez à ce lien pour accepter.')
add('access.accept.doneTitle', 'Invito accettato', 'Invitation accepted', 'Einladung angenommen', 'Invitation acceptée')
add('access.accept.doneBody', 'Ora fai parte di {company}. Accedi per iniziare.', 'You are now part of {company}. Sign in to get started.', 'Sie gehören jetzt zu {company}. Melden Sie sich an, um zu beginnen.', 'Vous faites maintenant partie de {company}. Connectez-vous pour commencer.')


import json

def q(text):
    return "'" + text.replace(chr(92), chr(92) * 2).replace("'", chr(92) + "'") + "'"

FILES = ['Italian', 'English', 'German', 'French']
CODES = ['it', 'en', 'de', 'fr']

if DIR is None:
    out = {code: {k: v[i] for k, v in T.items()} for i, code in enumerate(CODES)}
    with open('docs/access-management-translations.json', 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
    print('wrote docs/access-management-translations.json', len(T), 'keys x 4 languages')
    sys.exit(0)

for idx, name in enumerate(FILES):
    path = DIR + name + 'FrontendTranslations.php'
    src = open(path, encoding='utf-8', newline='').read()
    if "'access.nav.members'" in src:
        print('already applied', name)
        continue
    eol = chr(13) + chr(10) if chr(13) + chr(10) in src else chr(10)
    lines = ''.join("            %s => %s,%s" % (q(k), q(v[idx]), eol) for k, v in T.items())
    marker = '        ];' + eol + '    }' + eol + '}'
    pos = src.rstrip().rfind(marker)
    assert pos > 0, name
    src = src[:pos] + lines + src[pos:]
    open(path, 'w', encoding='utf-8', newline='').write(src)
    print('ok', name, len(T))
