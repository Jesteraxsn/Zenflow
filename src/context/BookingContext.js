"use client";

import { createContext, useContext, useEffect, useState } from "react";

// The customer's in-progress reservation while they move from
// treatment → schedule → checkout. Survives a login redirect (sessionStorage).
const BookingContext = createContext(null);
const STORAGE_KEY = "ginhawa-booking-draft";

const emptyDraft = {
  serviceId: null,
  duration: null,
  therapistMode: "any", // "any" | "specific"
  therapistId: null,
  date: null, // "YYYY-MM-DD" (Manila)
  time: null, // "HH:MM"
  addons: [], // "aromatherapy" | "hotStone" | "homeService"
  homeAddress: "",
  promoCode: "",
  senior: false, // Senior citizen / PWD discount (ID checked at the front desk)
  bookingId: null, // set once the slot is held in the database
};

export function BookingProvider({ children }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage once on mount
      if (saved) setDraft({ ...emptyDraft, ...JSON.parse(saved) });
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {}
  }, [draft, loaded]);

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const reset = () => setDraft(emptyDraft);

  return <BookingContext.Provider value={{ draft, update, reset, loaded }}>{children}</BookingContext.Provider>;
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used inside BookingProvider");
  return ctx;
}
