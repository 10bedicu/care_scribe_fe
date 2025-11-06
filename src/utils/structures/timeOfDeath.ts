import dayjs from "dayjs";
import { Structure } from ".";
import { z } from "zod";
import { shiftUTCToLocalClockTime, validateTime } from "../response-utils";

const toolStructure = z.object({
  time_of_death: z
    .string()
    .describe(`The time of death in ISO format, e.g. "2023-10-01T12:00:00Z"`),
});

export const timeOfDeathStructure: Structure<string[], typeof toolStructure> = {
  name: "Time of Death",
  description: "Structure for time of death",
  toolStructure,
  deserialize: async (data) => {
    const timeOfDeath = validateTime(data.time_of_death)
      ? shiftUTCToLocalClockTime(data.time_of_death)
      : undefined;

    return {
      data: timeOfDeath ? [timeOfDeath] : [],
      errors: [],
    };
  },
  toPrompt: (data) => {
    return dayjs(data[0]).format("DD/MM/YYYY HH:mm");
  },
};
