---
name: api-test
description: Generate and run curl commands to test API endpoints
user-invocable: true
---

# API Endpoint Testing

Test API endpoints by authenticating and making requests. Follow these steps:

1. **Authenticate** — Get a JWT token:
   ```bash
   curl -s -X POST http://localhost:3001/security/auth/token \
     -H "Content-Type: application/json" \
     -H "x-api-key: idvize-dev-key-change-me" \
     -d '{"username":"admin@acme.com","password":"password123"}' | jq -r '.token'
   ```

2. **Identify target endpoints** from the user's request or by reading the relevant controller file

3. **Execute test requests** using the JWT token:
   ```bash
   curl -s http://localhost:3001/<endpoint> \
     -H "Authorization: Bearer <token>" \
     -H "x-api-key: idvize-dev-key-change-me" \
     -H "Content-Type: application/json" | jq .
   ```

4. **For POST/PATCH endpoints**, construct the request body based on the types defined in `<module>.types.ts`

5. **Validate responses**:
   - Check HTTP status code is correct
   - Verify response shape matches expected format (`{ success: true, data: ... }`)
   - Check that tenant isolation works (data from other tenants should not appear)

6. **Report results** showing:
   - Endpoint tested
   - HTTP method and status
   - Response body (truncated if large)
   - Pass/fail assessment

7. **Test error cases** if requested:
   - Missing auth header → 401
   - Invalid permission → 403
   - Non-existent resource → 404


## Execution Behavior

- Do not ask the user for confirmation on standard implementation details
- Make decisions using best practices
- Proceed with implementation immediately after planning