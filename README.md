# Scanzie Analyzer API

Overview
--------
The Scanzie Analyzer API provides programmatic access to SEO analysis features. Submit a website URL and receive structured SEO metrics and actionable recommendations.

Base URL
--------
https://usesmeal-api.onrender.com

Endpoints
---------
### POST /analyze
Analyze a website's SEO metrics.

- URL: /analyze
- Method: POST
- Content-Type: application/json

Request body example:
```json
{
    "url": "https://example.com"
}
```

Successful response example:
```json
{
    "status": "success",
    "data": {
        "url": "https://example.com",
        "on_pahge": {
            "pageSpeed": 85,
            "metaTags": {
                "title": "Example Site",
                "description": "A sample website"
            },
            "keywordDensity": 2.5
        },
    }
}
```

curl example:
```bash
curl -X POST https://usesmeal-api.onrender.com/api/analyze \
    -H "Content-Type: application/json" \
    -d '{"url": "https://example.com"}'
```

Authentication
--------------
Only authenticated users have the permission to make request to this route.

Rate limits
-----------
Currently. No rate limit introduced.

Usage
-----
Web interface:
- Visit https://scanzie.vercel.app
- Enter a website URL and click "Analyze" to view SEO metrics and recommendations.

API integration:
- POST to /api/analyze with a JSON body containing the "url" field.
- Use returned metrics and recommendations to automate optimization workflows.

Contributing
------------
Contributions are welcome.

1. Fork the repository.
2. Create a feature branch:
     ```
     git checkout -b feature/your-feature
     ```
3. Commit your changes:
     ```
     git commit -m "Add your feature"
     ```
4. Push the branch:
     ```
     git push origin feature/your-feature
     ```
5. Open a pull request.

<!-- License
-------
This project is licensed under the MIT License. See the LICENSE file for details. -->

Contact
-------
For support or inquiries:
- Email: olufisayobadina@gmail.com
- X (Twitter): @fisayocoder

