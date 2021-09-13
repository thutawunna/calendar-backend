import { turquoise } from 'color-name';
import Moment from 'moment';
import { extendMoment } from 'moment-range';

const moment = extendMoment(Moment);

export function checkEventAvailability( userEvents, newEvent ) {
    
    const newEventRange = moment.range(newEvent.start, newEvent.end);

    for (var i = 0; i < userEvents.length; ++i) {
        let eventRange = moment.range(userEvents[i].start, userEvents[i].end);

        if (eventRange.overlaps(newEventRange)) {
            return false;
        }
    }

    return true;
}

export function validateEvent( newEvent ) {
    let newEventStart_DateObject = new Date(newEvent.start);
    let newEventEnd_DateObject = new Date(newEvent.end);

    return newEventStart_DateObject != newEventEnd_DateObject && newEventEnd_DateObject > newEventStart_DateObject;
}

export function processDateTimeString( dateTimeString ) {
    const timeZoneOffset = (new Date().getTimezoneOffset()) / 60;
    const meetingTime = new Date(dateTimeString);
    meetingTime.setHours(meetingTime.getHours() - (7 - timeZoneOffset));

    return meetingTime.toISOString();
}