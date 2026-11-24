// What each stage adds. Every stage is the whole system with one more question answered, so a
// feature switched on at stage 2 stays on at stages 3 and 4. Search for "F." in worker.js to see
// exactly where each one changes the behavior.

export const STAGES = [
  "Stage 0: prototype",
  "Stage 1: connect it",
  "Stage 2: real data",
  "Stage 3: run it safely",
  "Stage 4: grow it",
];

export function features(stage) {
  return {
    // Stage 1. How do users reach it, and where does the person act?
    conversation: stage >= 1,   // a client's messages belong to one conversation
    login: stage >= 1,          // the inbox is only visible after the caterer logs in
    // Stage 2. Where does the truth live, and what must it remember?
    kept: stage >= 2,           // enquiries survive a restart
    priceTable: stage >= 2,     // the price list lives in the database; the caterer edits it on her page
    // Stage 3. Where does it run, why would a customer trust it, what does a conversation cost?
    mask: stage >= 3,           // phone numbers and emails hidden before the model reads a message
    failSafe: stage >= 3,       // when the model fails: a polite reply, and the enquiry goes to the caterer
    dailyLimit: stage >= 3,     // a limit on new enquiries per day
    deletion: stage >= 3,       // each enquiry deleted 30 days after its last message
    cost: stage >= 3,           // a cost page
    // Stage 4. What changes with many users?
    manyCaterers: stage >= 4,  // several caterers, each with their own login, price list and enquiries
    log: stage >= 4,            // a log page the team can read
  };
}

// The caterers. Until stage 4 only Huda can log in. Their login codes are a secret
// (CATERER_LOGINS), never in this file.
export const CATERERS = { huda: "Huda", "caterer-b": "Caterer B", "caterer-c": "Caterer C" };
