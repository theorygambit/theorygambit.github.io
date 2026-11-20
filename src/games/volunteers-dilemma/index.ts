import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { VolunteersDilemmaGame } from "./VolunteersDilemmaGame";

const theory: TheoryEntry = {
  idea: "One person must act for everyone's benefit, and acting costs. Everyone hopes it is someone else. In equilibrium each person steps up only some of the time, and a bigger group makes each person step up less, so help gets less likely.",
  taught: [
    { beat: "Feel", text: "You and four others, a lamp worth 3 to all that costs 1 to fix. Step up or wait, five times, and see what the other choice would have paid." },
    { beat: "See", text: "Drag the size of the group. Each person steps up less, and the chance that nobody helps climbs toward cost over benefit." },
    { beat: "Prove", text: "Two new groups with new benefit and cost. Set the chance each steps up so that waiting and stepping up pay the same." },
  ],
  math: [
    { label: "Stepping up pays", expr: "B - C, for sure" },
    { label: "Waiting pays, when each other player steps up with chance p", expr: "B * (1 - (1 - p)^(n - 1))" },
    { label: "Indifference", expr: "(1 - p)^(n - 1) = C / B, so p = 1 - (C / B)^(1 / (n - 1))" },
    { label: "Chance that nobody helps", expr: "(C / B)^(n / (n - 1)), rising with n toward C / B" },
  ],
  remember: "The more people who could help, the less likely each one is to.",
  practice: "Bystanders at an emergency, a shared report nobody files, a bug in a team repository, a raid that needs one person to take the risk. Make the cost of stepping up small, or give one person the job by name.",
  origin: "Analysed by Andreas Diekmann in 1985, building on bystander research in social psychology.",
};

export const volunteersDilemma: GameModule = {
  slug: "volunteers-dilemma",
  hook: "Why help gets rarer in a crowd.",
  create: (env) => new VolunteersDilemmaGame(env),
  theory,
};
