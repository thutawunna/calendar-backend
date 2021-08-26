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