import React, { useEffect, useMemo, useState } from "react";

/**
 * سامانه نوبت‌دهی آرایشگاه — نمای تک‌روزه + حالت ادمین با پین
 * - chips انتخاب روز (اسکرولی)
 * - فقط «یک روزِ انتخاب‌شده» نمایش داده می‌شود
 * - حالت ادمین با پین (1234)؛ کنترل‌های مدیریتی فقط برای ادمین
 * - ذخیره تستی در localStorage (برای تولیدی، بک‌اند لازم است)
 */

// YYYY-MM-DD
function ymd(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// نام روز فارسی
function weekdayFa(d) {
  const days = [
    "یکشنبه",
    "دوشنبه",
    "سه‌شنبه",
    "چهارشنبه",
    "پنجشنبه",
    "جمعه",
    "شنبه",
  ];
  return days[new Date(d).getDay()];
}

// اسلات‌های نیم‌ساعته
function generateSlots(startHour = 9, endHour = 21) {
  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

const STORAGE_KEY = "barbershop_booking_state_v2_single_day";
const ADMIN_PIN = "1234"; // پین ادمین (برای تست)

export default function App() {
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(21);
  const [daysCount] = useState(7);

  // { bookings: { [date]: { [time]: {firstName,lastName,phone} } }, disabledDays: { [date]: true }, disabledSlots: { [date]: { [time]: true } } }
  const [state, setState] = useState({
    bookings: {},
    disabledDays: {},
    disabledSlots: {},
  });

  // حالت ادمین
  const [isAdmin, setIsAdmin] = useState(false);

  // بارگذاری از localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setState({
          bookings: parsed.bookings || {},
          disabledDays: parsed.disabledDays || {},
          disabledSlots: parsed.disabledSlots || {},
        });
        if (typeof parsed.startHour === "number")
          setStartHour(parsed.startHour);
        if (typeof parsed.endHour === "number") setEndHour(parsed.endHour);
      }
    } catch (e) {
      console.warn("Failed to load state:", e);
    }
  }, []);

  // ذخیره در localStorage
  useEffect(() => {
    const payload = JSON.stringify({ ...state, startHour, endHour });
    localStorage.setItem(STORAGE_KEY, payload);
  }, [state, startHour, endHour]);

  // ۷ روز آینده
  const days = useMemo(() => {
    const res = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      res.push(d);
    }
    return res;
  }, [daysCount]);

  const [selectedDate, setSelectedDate] = useState(ymd(new Date()));
  const slots = useMemo(
    () => generateSlots(startHour, endHour),
    [startHour, endHour]
  );

  const [selected, setSelected] = useState({ date: ymd(new Date()), time: "" });
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [message, setMessage] = useState("");

  // helpers
  const isDayDisabled = (dateStr) => !!state.disabledDays[dateStr];
  const toggleDayDisabled = (dateStr) => {
    if (!isAdmin) return;
    setState((prev) => ({
      ...prev,
      disabledDays: {
        ...prev.disabledDays,
        [dateStr]: !prev.disabledDays[dateStr],
      },
    }));
  };
  const isSlotDisabled = (dateStr, time) =>
    !!state.disabledSlots[dateStr]?.[time];
  const toggleSlotDisabled = (dateStr, time) => {
    if (!isAdmin) return;
    setState((prev) => {
      const map = { ...(prev.disabledSlots[dateStr] || {}) };
      map[time] = !map[time];
      return {
        ...prev,
        disabledSlots: { ...prev.disabledSlots, [dateStr]: map },
      };
    });
  };
  const isBooked = (dateStr, time) => !!state.bookings?.[dateStr]?.[time];

  function handleSelect(dateStr, time) {
    setSelected({ date: dateStr, time });
    setMessage("");
  }

  function validatePhone(phone) {
    const cleaned = phone.replace(/\s|-/g, "");
    return /^\+?\d{10,14}$/.test(cleaned);
  }

  function submitBooking(e) {
    e?.preventDefault?.();
    setMessage("");

    const { date, time } = selected;
    if (!date || !time) return setMessage("ابتدا روز و ساعت را انتخاب کنید.");
    if (isDayDisabled(date))
      return setMessage("این روز غیرفعال است و امکان رزرو ندارد.");
    if (isSlotDisabled(date, time))
      return setMessage("این بازه زمانی غیرفعال شده است.");
    if (isBooked(date, time))
      return setMessage("این بازه زمانی قبلاً رزرو شده است.");
    if (!form.firstName.trim() || !form.lastName.trim())
      return setMessage("نام و نام خانوادگی را کامل وارد کنید.");
    if (!validatePhone(form.phone))
      return setMessage("شماره تماس معتبر وارد کنید (۱۰ تا ۱۴ رقم).");

    setState((prev) => {
      const dayBookings = { ...(prev.bookings[date] || {}) };
      dayBookings[time] = { ...form, phone: form.phone.trim() };
      return { ...prev, bookings: { ...prev.bookings, [date]: dayBookings } };
    });

    setMessage("نوبت با موفقیت ثبت شد ✅");
  }

  function cancelBooking(dateStr, time) {
    setState((prev) => {
      const dayBookings = { ...(prev.bookings[dateStr] || {}) };
      delete dayBookings[time];
      return {
        ...prev,
        bookings: { ...prev.bookings, [dateStr]: dayBookings },
      };
    });
  }

  function clearAll() {
    if (!isAdmin) return;
    if (!confirm("همه داده‌ها (رزروها/غیرفعال‌ها) پاک شود؟")) return;
    setState({ bookings: {}, disabledDays: {}, disabledSlots: {} });
  }

  function adminLogin() {
    if (isAdmin) {
      setIsAdmin(false);
      return;
    }
    const pin = prompt("پین ادمین را وارد کنید:");
    if (pin === ADMIN_PIN) setIsAdmin(true);
    else alert("پین نادرست است");
  }

  // همگام‌سازی selectedDate با فرم
  useEffect(() => {
    setSelected((s) => ({ ...s, date: selectedDate }));
  }, [selectedDate]);

  const selectedDateObj = useMemo(() => new Date(selectedDate), [selectedDate]);

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 text-gray-900">
      {/* هدر + ورود ادمین + نوار روزها */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold">
            سامانه نوبت‌دهی آرایشگاه
          </h1>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={clearAll}
                className="px-3 py-2 rounded-2xl bg-red-100 hover:bg-red-200 text-red-700 text-sm"
              >
                پاک‌سازی
              </button>
            )}
            <button
              onClick={adminLogin}
              className="px-3 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm"
            >
              {isAdmin ? "خروج ادمین" : "ورود ادمین"}
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-3 overflow-x-auto">
          <div className="flex gap-2 w-max">
            {days.map((d) => {
              const dateStr = ymd(d);
              const active = selectedDate === dateStr;
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`px-3 py-2 rounded-2xl border min-h-[36px] text-sm whitespace-nowrap ${
                    active
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  {weekdayFa(d)} —{" "}
                  {new Intl.DateTimeFormat("fa-IR", {
                    month: "numeric",
                    day: "numeric",
                  }).format(d)}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* تنظیمات ساعات کاری (فقط ادمین) */}
        <section
          className={`bg-white rounded-2xl shadow p-4 ${
            !isAdmin ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <h2 className="text-lg font-semibold mb-3">تنظیمات ساعات کاری</h2>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2">
              شروع:
              <input
                type="number"
                min={0}
                max={23}
                value={startHour}
                onChange={(e) =>
                  setStartHour(
                    Math.min(23, Math.max(0, Number(e.target.value)))
                  )
                }
                className="w-24 border rounded-xl px-3 py-2"
              />
              <span>:00</span>
            </label>
            <label className="flex items-center gap-2">
              پایان:
              <input
                type="number"
                min={1}
                max={24}
                value={endHour}
                onChange={(e) =>
                  setEndHour(Math.min(24, Math.max(1, Number(e.target.value))))
                }
                className="w-24 border rounded-xl px-3 py-2"
              />
              <span>:00</span>
            </label>
            <div className="text-sm text-gray-600"></div>
          </div>
        </section>

        {/* فرم رزرو */}
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="text-lg font-semibold mb-3">ثبت نوبت</h2>
          <form
            onSubmit={submitBooking}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"
          >
            <div>
              <label className="block text-sm mb-1">روز انتخابی</label>
              <select
                value={selected.date}
                onChange={(e) =>
                  setSelected((s) => ({ ...s, date: e.target.value }))
                }
                className="w-full border rounded-xl px-3 py-2"
              >
                {days.map((d) => (
                  <option key={ymd(d)} value={ymd(d)}>
                    {weekdayFa(d)}،{" "}
                    {new Intl.DateTimeFormat("fa-IR", {
                      month: "long",
                      day: "numeric",
                    }).format(d)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">ساعت انتخابی</label>
              <select
                value={selected.time}
                onChange={(e) =>
                  setSelected((s) => ({ ...s, time: e.target.value }))
                }
                className="w-full border rounded-xl px-3 py-2"
              >
                <option value="">— انتخاب کنید —</option>
                {slots.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">نام</label>
              <input
                value={form.firstName}
                onChange={(e) =>
                  setForm({ ...form, firstName: e.target.value })
                }
                className="w-full border rounded-xl px-3 py-2"
                placeholder="مثلاً علی"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">نام خانوادگی</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full border rounded-xl px-3 py-2"
                placeholder="مثلاً رضایی"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block text-sm mb-1">شماره تماس</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border rounded-xl px-3 py-2"
                placeholder="مثلاً 0912xxxxxxx"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-3">
              <button
                type="submit"
                className="px-4 py-2 rounded-2xl bg-black text-white hover:opacity-90"
              >
                ثبت نوبت
              </button>
              {message && (
                <div className="text-sm text-green-700">{message}</div>
              )}
            </div>
          </form>
        </section>

        {/* نمای تک‌روزه (اسلات‌ها) */}
        <section className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">
              {weekdayFa(selectedDateObj)} —{" "}
              {new Intl.DateTimeFormat("fa-IR", {
                month: "long",
                day: "numeric",
              }).format(selectedDateObj)}
            </h2>
            <button
              onClick={() => toggleDayDisabled(selectedDate)}
              className={`px-3 py-1 rounded-xl text-sm ${
                isDayDisabled(selectedDate)
                  ? "bg-red-100 text-red-700"
                  : "bg-emerald-100 text-emerald-700"
              } ${!isAdmin ? "hidden" : ""}`}
            >
              {isDayDisabled(selectedDate) ? "روز غیرفعال" : "روز فعال"}
            </button>
          </div>

          <div
            className={`${
              isDayDisabled(selectedDate)
                ? "opacity-50 pointer-events-none"
                : ""
            }`}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {slots.map((t) => {
                const booked = !!state.bookings[selectedDate]?.[t];
                const disabled = !!state.disabledSlots[selectedDate]?.[t];
                return (
                  <div
                    key={t}
                    className="border rounded-xl p-2 flex items-center justify-between gap-2"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{t}</span>
                      {booked && (
                        <span className="text-xs text-gray-600">
                          {state.bookings[selectedDate][t].firstName}{" "}
                          {state.bookings[selectedDate][t].lastName} —{" "}
                          {state.bookings[selectedDate][t].phone}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSelect(selectedDate, t)}
                        disabled={booked || disabled}
                        className={`px-3 py-1 rounded-xl text-sm ${
                          booked
                            ? "bg-gray-200 text-gray-500"
                            : disabled
                            ? "bg-amber-100 text-amber-800"
                            : "bg-black text-white hover:opacity-90"
                        }`}
                      >
                        {booked ? "رزرو شد" : disabled ? "غیرفعال" : "انتخاب"}
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => toggleSlotDisabled(selectedDate, t)}
                          className={`px-3 py-1 rounded-xl text-sm ${
                            disabled
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {disabled ? "فعال‌سازی" : "غیرفعال‌سازی"}
                        </button>
                      )}
                      {booked && isAdmin && (
                        <button
                          onClick={() => cancelBooking(selectedDate, t)}
                          className="px-3 py-1 rounded-xl text-sm bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          لغو
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* نکات */}
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="text-lg font-semibold mb-2">نکات</h2>
          <ul className="list-disc pr-5 space-y-1 text-sm text-gray-700">
            <li>
              برای نسخهٔ تولیدی، بک‌اند/دیتابیس (مثلاً Supabase/Firebase) برای
              همگام‌سازی و نقش ادمین واقعی اضافه کنید.
            </li>
            <li>ارسال پیامک/واتساپ تأیید بعد از رزرو.</li>
            <li>چند آرایشگر و سرویس‌های با مدت متفاوت.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
