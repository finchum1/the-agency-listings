// Parts of Deals that are switched off for the time being. Nothing is deleted: the code, the database tables and any saved data stay as
// they are, and setting a flag back to true brings that part of the screen back.
//   DEAL_SIGNING     e-signature requests (the Signatures block in a deal's Documents tab, "out for signature" notices)
//   DEAL_COMPLIANCE  submitting a deal for review, the review status chips and filters, "sent back" notices, flagged documents, and the
//                    Messages tab (the review conversation). The office does its compliance in SkySlope.
export const DEAL_SIGNING = false;
export const DEAL_COMPLIANCE = false;
