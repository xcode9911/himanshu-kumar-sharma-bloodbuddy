Brevo SMTP / API Email Delivery Troubleshooting
==============================================

Quick summary
- If both Nodemailer (Gmail) and Brevo SMTP are timing out on your deployed host, the host likely blocks outbound SMTP (common on PaaS). Use Brevo HTTP API as a robust fallback.

Required env vars
- `SMTP_USER` / `SMTP_PASS` — primary SMTP (Gmail)
- `BREVO_SMTP_HOST` / `BREVO_SMTP_PORT` / `BREVO_SMTP_USER` / `BREVO_SMTP_PASS` — Brevo SMTP relay credentials
- `BREVO_API_KEY` — Brevo Transactional API key (preferred for PaaS)

Commands to run on the deployed host
1) Get public outbound IP (so you can allowlist it in Brevo if using SMTP):

```bash
curl -s ifconfig.me
```

2) Test TCP connectivity to Brevo SMTP (port 587):

```bash
nc -vz smtp-relay.brevo.com 587
```

3) Test TLS handshake:

```bash
openssl s_client -starttls smtp -connect smtp-relay.brevo.com:587 -crlf </dev/null
```

4) Optionally run transporter verify (Node) from the deployed project folder:

```bash
# Verify Nodemailer transporter
node -e "(async()=>{const t=require('./dist/src/utils/emailService.js'); if(t.nodemailerTransporter) t.nodemailerTransporter.verify().then(()=>console.log('nodemailer ok')).catch(e=>console.error(e)); else console.log('nodemailer not configured')})()"

# Verify Brevo SMTP transporter
node -e "(async()=>{const t=require('./dist/src/utils/emailService.js'); if(t.brevoTransporter) t.brevoTransporter.verify().then(()=>console.log('brevo smtp ok')).catch(e=>console.error(e)); else console.log('brevo smtp not configured')})()"
```

If SMTP is blocked
- Use `BREVO_API_KEY` and set it in your Render/host environment; the code now falls back to the Brevo HTTP API when SMTP fails.

If Brevo SMTP returns `525 5.7.1 Unauthorized IP address`
- Either allowlist your server's outbound IP in Brevo SMTP relay settings or switch to the Transactional API (HTTP) which does not require IP allowlisting.

Notes
- The project already includes a tertiary fallback: Nodemailer → Brevo SMTP → Brevo HTTP API (if `BREVO_API_KEY` is set).
