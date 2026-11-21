# messaging-service

**Phase 3** · Port `8005` · DB `worklens_messaging`

HOD to faculty chat, announcements, course messages and the real-time Socket.IO layer.

## Public routes
- `/api/dept-messages/*`
- `/api/messages/*` (faculty to course audience messages)
- WebSocket `/socket.io` (events: `dm:new`, `dm:read`, `dm:updated`, `dm:deleted`, `dm:unread`, `typing`, `presence`)

## Moves here from the monolith
- Models: `DeptConversation`, `DeptMessage`, `DeptAnnouncement`, `teaching/models/Message`
- Controllers: `deptMessageController`, `messageController`
- Utils: `shared/utils/socket.js`, `shared/utils/deptChat.js`
- Script: `testDeptMessages.js`

## Depends on
- auth-service `GET /internal/users/:id`, only if `dept` is not in the JWT. Once `dept` is in the token,
  the socket handshake needs no lookup.

## Gateway requirement
The gateway must proxy WebSocket upgrades (`ws: true`) for `/socket.io`.

## Env
```env
PORT=8005
MONGO_URI=mongodb://127.0.0.1:27017/worklens_messaging
JWT_SECRET=
CLIENT_ORIGIN=http://localhost:5173
AUTH_URL=http://localhost:8001
```
