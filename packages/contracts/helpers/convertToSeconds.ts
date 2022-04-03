export interface ITime {
  months?: number;
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  years?: number;
}

export const convertToSeconds = (period: ITime): number => {
  let seconds = 0;
  if (period?.seconds) {
    seconds += period.seconds;
  }
  if (period?.minutes) {
    seconds += period.minutes * 60;
  }
  if (period?.hours) {
    seconds += period.hours * 3600;
  }
  if (period?.days) {
    seconds += period.days * 86400;
  }
  if (period?.weeks) {
    seconds += period.weeks * 604800;
  }
  if (period?.months) {
    seconds += period.months * 2629800;
  }
  if (period?.years) {
    seconds += period.years * 31540000;
  }
  return seconds;
};

export default convertToSeconds;
