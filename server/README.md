# CS Valley Cloud Server

Express + MongoDB backend for account registration, login, authenticated save syncing, and save loading.

## Required environment variables

- `MONGO_URI`: MongoDB connection string.
- `JWT_SECRET`: secret used to sign login tokens.
- `PORT`: optional, defaults to `3000`.

## API

- `POST /api/register`
- `POST /api/login`
- `POST /api/sync` with `Authorization: Bearer <token>`
- `GET /api/user/me` with `Authorization: Bearer <token>`
- `GET /api/user/:username` with `Authorization: Bearer <token>`
