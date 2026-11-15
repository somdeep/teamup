# TeamUp mock data

Simulated Art of Living exports (Eventbrite, Harmony, Retreat Guru), cleaned for TeamUp.
All people are fictional. Only fields TeamUp needs are kept.

Removed on purpose:
- Payments: orders, ticket classes, fees, fee info, transactions, balances
- Health and personal: health consent, dietary answers, emergency contacts, birth dates, gender, age group, street addresses, device info
- Housing: accommodations, rooms, lodging, rentals
- Children's retreat registrations
- source_records.csv (duplicate copy of the files above)

Not in the source data, so TeamUp generates and labels them as simulated: volunteer skills, weekly availability.

_identity_ground_truth.csv is for scoring duplicate-person matching only. Never use it as matching input.
Course names come from the Art of Living Courses sheet. The live Unity API is a shared production system, so TeamUp does not call it.
