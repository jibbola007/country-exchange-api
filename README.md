Country Exchange API

A RESTful API that fetches country data, matches it with exchange rates, computes estimated GDP, and stores it in MySQL.

 Features

Fetch & cache country data from external APIs

Compute estimated_gdp using random multipliers and exchange rates

Serve endpoints for filtering, sorting, deleting, and status checks

Generate summary image after refresh

🔧 Tech Stack

Node.js / Express

MySQL (via Sequelize or direct queries)

dotenv for environment config

Canvas for image generation

 Setup Instructions

Clone the repo

git clone https://github.com/yourusername/country-exchange-api.git
cd country-exchange-api


Install dependencies

npm install


Create your .env file

cp .env.example .env


Update your DB credentials inside.

Run migrations

mysql -u root -p countriesdb < migrations/001-create-tables.sql


Start the server

npm run dev


Test endpoints

POST /countries/refresh
GET  /countries
GET  /countries/:name
DELETE /countries/:name
GET  /countries/status
GET  /countries/image

 Example Response
{
  "total_countries": 250,
  "last_refreshed_at": "2025-10-28T04:28:52.487Z"
}

 Notes

API hosted on Railway (Render/Vercel not allowed)

.env file required for local testing