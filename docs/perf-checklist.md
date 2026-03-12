# Performance Checklist

- Keep geometry lightweight and batched.
- Use PERFORMANCE profile defaults on mobile.
- Cap visible stop markers at 300 in PERFORMANCE profile.
- Use dynamic resolution scale 0.75 in PERFORMANCE profile.
- Lazy-load shapes after first critical render.
- Validate route worker response time stays below 2500ms timeout for normal routes.
- Keep transit assets compressed and hashed for cache-first behavior.
