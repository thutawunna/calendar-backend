const express = require('express');
const { createEventAdapter } = require('@slack/events-api');


const router = express.Router();

module.exports = (params) => {

    const slackEvents = createEventAdapter(process.env.SLACK_SIGNING_SECRET);

    router.use('/events', slackEvents.requestListener());

    return router;
};