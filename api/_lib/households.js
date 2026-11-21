// Households for the server paths that write with the service key (the Mac app's API), where the database functions link_household / leave_household
// (supabase/contact-households.sql) can't be used because they go by the signed-in login. The same rules, always limited to one agent's own contacts.
export class HouseholdError extends Error {}

/** Put two contacts in one household: join an existing one, merge two, or make a new one named after the shared last name or the first names. */
export async function linkHousehold(admin, owner, aId, bId) {
  if (aId === bId) throw new HouseholdError("Pick two different people.");
  const { data: rows } = await admin.from("contacts").select("id, first_name, last_name, company, household_id").eq("owner_id", owner).in("id", [aId, bId]);
  const a = (rows || []).find((c) => c.id === aId);
  const b = (rows || []).find((c) => c.id === bId);
  if (!a || !b) throw new HouseholdError("Those contacts aren't yours to link.");
  let hid;
  if (a.household_id) {
    hid = a.household_id;
    if (b.household_id && b.household_id !== hid) {
      await admin.from("contacts").update({ household_id: hid }).eq("owner_id", owner).eq("household_id", b.household_id);
      await admin.from("contact_households").delete().eq("id", b.household_id).eq("owner_id", owner);
    }
  } else if (b.household_id) {
    hid = b.household_id;
  } else {
    const last = (c) => String(c.last_name || "").trim();
    const first = (c) => String(c.first_name || c.company || "").trim();
    const name = last(a) && last(a).toLowerCase() === last(b).toLowerCase() ? `${last(a)} household` : [first(a), first(b)].filter(Boolean).join(" & ");
    const { data, error } = await admin.from("contact_households").insert({ owner_id: owner, name: name.slice(0, 80) }).select("id").single();
    if (error) throw new HouseholdError("Couldn't make the household.");
    hid = data.id;
  }
  const { error } = await admin.from("contacts").update({ household_id: hid }).eq("owner_id", owner).in("id", [aId, bId]);
  if (error) throw new HouseholdError("Couldn't link them.");
  return hid;
}

/** A household with fewer than two people isn't one: dissolve it. */
export async function tidyHousehold(admin, owner, householdId) {
  if (!householdId) return;
  const { count } = await admin.from("contacts").select("id", { count: "exact", head: true }).eq("owner_id", owner).eq("household_id", householdId);
  if ((count || 0) < 2) {
    await admin.from("contacts").update({ household_id: null }).eq("owner_id", owner).eq("household_id", householdId);
    await admin.from("contact_households").delete().eq("id", householdId).eq("owner_id", owner);
  }
}

export async function leaveHousehold(admin, owner, contactId) {
  const { data: c } = await admin.from("contacts").select("household_id").eq("id", contactId).eq("owner_id", owner).maybeSingle();
  if (!c) throw new HouseholdError("That contact isn't yours.");
  await admin.from("contacts").update({ household_id: null }).eq("id", contactId).eq("owner_id", owner);
  await tidyHousehold(admin, owner, c.household_id);
}
