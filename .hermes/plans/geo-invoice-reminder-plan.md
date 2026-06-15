# Plan: Geolocation + Invoice WhatsApp + Payment Reminders

## 1. Geolocation Tracking
**Webapp CAN track via browser Geolocation API**
- Store lat/lng in DB on: login, order creation, delivery confirmation
- Add `user_locations` table (user_id, lat, lng, timestamp, context)
- Show last known location in HR/SalesRep dashboard
- Backend: POST endpoint to log location
- Frontend: Background geolocation on page load & key actions

## 2. Invoice WhatsApp Button
- Add WhatsApp button next to each invoice in Sales/Invoices view
- Generate message with invoice number, client, amount, due date
- Use existing `sendWhatsApp` utility or direct wa.me link

## 3. Payment Reminder System
- Backend cron/check on sales page load:
  - Check invoices due in 10 days → mark/notify
  - Check invoices due in 5 days → mark/notify
  - Check invoices due today → mark/notify
- Frontend:
  - "Upcoming Reminders" section in Sales module
  - One-click send WhatsApp reminder
  - Dashboard widget per sales rep showing delayed/pending reminders
  - Daily reminder button that sends to all overdue clients
