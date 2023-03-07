# anonmi (anonymous me) API backend

anonmi is an anonymous Q&A platform. The platform should give the freedom to
users to send you a message without having to disclose their personal info. No
account creation is needed when sending a message to any user which makes it
easier for anyone to use this application

### Tech stack
- node.js
- express
- next.js
- sqlite

### Running the server up
Create a `.env` file with the following data
```
PORT=8000
MAIL_SERVICE=<your_host_email_service>
MAIL_USER=<your_host_email>
MAIL_PASS=<your_host_email_passw>
TARGET_MAIL=<your_email>
MASTER_SALT=<your_secret>
ENV=DEV
```

After that, you need to build the app using `npm run build` and running dev
server using `npm run dev`
