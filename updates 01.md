Done. I merged the requirements into a single detailed master implementation document, including:

* 🔐 Security audit and hardening
* 🗄️ Google Drive + Local-Only storage architecture
* 💾 IndexedDB local storage
* 🔄 Local → Google Drive migration
* ☁️ Google Drive → new Google Drive migration
* ⚠️ Global error transparency and actionable recovery
* 🔁 Safe retry/idempotency requirements
* 🧾 Legal consent/versioning/PDF requirements
* 🔎 SEO and launch readiness
* 📱 Mobile and accessibility
* 🎨 UI/UX polish
* 🚦 Performance
* 🧪 Comprehensive testing matrix
* 🛡️ Database/migration safety rules
* 👨‍💻 Git/commit/deployment safety
* 📋 Final launch-readiness checklist

It specifically includes your **Google Drive full → switch to another Drive → migrate → verify → switch source of truth** workflow, as well as **Continue on this Device** for users who don't want Google Drive.

### Download

[**Download Penny Pilot Master Implementation Plan (.md)**](sandbox:/mnt/data/Penny-Pilot-Master-Implementation-Plan.md)

The document is intentionally detailed so you can give it directly to Claude Code as the master implementation specification.
