import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  AlertCircle,
  Armchair,
  ArrowLeft,
  ArrowRight,
  BusFront,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

import SeatLayout from "../../components/booking/seatLayout";
import { busService } from "../../services/busService";

const PLATFORM_FEE = 20;
const GST_RATE = 0.05;

const formatCurrency = (amount) => {
  return Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
};

const formatJourneyDate = (date) => {
  if (!date) return "Journey date not selected";

  const parsedDate = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) return date;

  return parsedDate.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const sortSeats = (seats = []) => {
  return [...seats].sort((a, b) => {
    const matchA = String(a).match(/(\d+)([A-D])/);
    const matchB = String(b).match(/(\d+)([A-D])/);

    if (!matchA || !matchB) return String(a).localeCompare(String(b));

    return (
      Number(matchA[1]) - Number(matchB[1]) ||
      matchA[2].localeCompare(matchB[2])
    );
  });
};

const normalizeBus = (bus) => {
  if (!bus) return null;

  const price =
    bus.price ||
    bus.fare ||
    bus.ticketPrice ||
    bus.baseFare ||
    bus.seatPrice ||
    0;

  return {
    ...bus,
    id: bus._id || bus.id,
    _id: bus._id || bus.id,
    name: bus.name || bus.busName || bus.operatorName || "TedBus Partner",
    type: bus.type || bus.busType || bus.category || "Standard Bus",
    source: bus.source || "Source",
    destination: bus.destination || "Destination",
    departure: bus.departure || bus.departureTime || bus.startTime || "—",
    arrival: bus.arrival || bus.arrivalTime || bus.endTime || "—",
    duration: bus.duration || "—",
    price,
    seatsAvailable:
      bus.seatsAvailable ||
      bus.availableSeats ||
      bus.totalAvailableSeats ||
      bus.availableSeatCount ||
      bus.seats ||
      bus.totalSeats ||
      0,
    boardingPoints: Array.isArray(bus.boardingPoints) ? bus.boardingPoints : [],
    droppingPoints: Array.isArray(bus.droppingPoints) ? bus.droppingPoints : [],
  };
};

const SeatSelection = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const stateBus = location.state?.bus || null;
  const stateJourneyDate = location.state?.journeyDate || "";
  const queryJourneyDate = searchParams.get("date") || "";

  const [bus, setBus] = useState(() => normalizeBus(stateBus));
  const [journeyDate, setJourneyDate] = useState(
    queryJourneyDate || stateJourneyDate || "",
  );

  const [selectedSeats, setSelectedSeats] = useState([]);
  const [bookedSeats, setBookedSeats] = useState([]);

  const [selectedBoardingPoint, setSelectedBoardingPoint] = useState("");
  const [selectedDroppingPoint, setSelectedDroppingPoint] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const seatPrice = Number(bus?.price || 0);

  const baseFare = selectedSeats.length * seatPrice;
  const platformFee = selectedSeats.length > 0 ? PLATFORM_FEE : 0;
  const gst = baseFare * GST_RATE;
  const totalAmount = baseFare + platformFee + gst;

  const sortedSelectedSeats = useMemo(() => {
    return sortSeats(selectedSeats);
  }, [selectedSeats]);

  const fetchSeatData = async () => {
    try {
      setLoading(true);
      setError("");

      const finalDate = queryJourneyDate || stateJourneyDate || journeyDate;

      if (!finalDate) {
        throw new Error("Journey date is missing. Please search buses again.");
      }

      const response = await busService.getBusSeats(id, {
        date: finalDate,
      });

      const apiBus = busService.extractBus(response);
      const normalizedBus = normalizeBus(apiBus);

      const apiBookedSeats = busService.extractBookedSeats(response);

      if (!normalizedBus) {
        throw new Error("Unable to load bus details");
      }

      setBus(normalizedBus);
      setJourneyDate(finalDate);
      setBookedSeats(apiBookedSeats);

      if (!selectedBoardingPoint && normalizedBus.boardingPoints?.length) {
        setSelectedBoardingPoint(normalizedBus.boardingPoints[0]);
      }

      if (!selectedDroppingPoint && normalizedBus.droppingPoints?.length) {
        setSelectedDroppingPoint(normalizedBus.droppingPoints[0]);
      }

      setSelectedSeats([]);
    } catch (err) {
      setError(err?.message || "Unable to load seat availability");
      setBookedSeats([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    fetchSeatData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, queryJourneyDate]);

  const validateBeforeContinue = () => {
    if (selectedSeats.length === 0) {
      alert("Please select at least one seat to continue.");
      return false;
    }

    if (bus?.boardingPoints?.length > 0 && !selectedBoardingPoint) {
      alert("Please select boarding point.");
      return false;
    }

    if (bus?.droppingPoints?.length > 0 && !selectedDroppingPoint) {
      alert("Please select dropping point.");
      return false;
    }

    if (!journeyDate) {
      alert("Journey date missing. Please search buses again.");
      return false;
    }

    return true;
  };

  const handleContinue = () => {
    if (!validateBeforeContinue()) return;

    const pendingBooking = {
      busId: id,
      bus,
      busDetails: bus,
      journeyDate,
      seats: sortedSelectedSeats,
      selectedSeats: sortedSelectedSeats,
      boardingPoint: selectedBoardingPoint,
      droppingPoint: selectedDroppingPoint,
      fare: {
        seatPrice,
        baseFare,
        platformFee,
        gst,
        totalAmount,
      },
      amount: totalAmount,
    };

    sessionStorage.setItem(
      "tedbus_pending_booking",
      JSON.stringify(pendingBooking),
    );

    navigate("/passenger-info", {
      state: pendingBooking,
    });
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 h-36 animate-pulse rounded-[2rem] bg-slate-200" />

          <div className="grid gap-8 lg:grid-cols-3">
            <div className="h-[760px] animate-pulse rounded-[2rem] bg-slate-200 lg:col-span-2" />
            <div className="h-[520px] animate-pulse rounded-[2rem] bg-slate-200" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !bus) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-red-100 bg-red-50 p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-600" />

          <h1 className="mt-4 text-2xl font-black text-slate-900">
            Seats unavailable
          </h1>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
            {error || "Unable to load seats for this bus."}
          </p>

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={fetchSeatData}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700"
            >
              <RefreshCcw className="h-4 w-4" />
              Retry
            </button>

            <Link
              to="/search-bus"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Search
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Top Header */}
      <section className="bg-gradient-to-br from-red-600 via-red-500 to-orange-500 px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Link
            to={`/bus/${id}${journeyDate ? `?date=${journeyDate}` : ""}`}
            state={{
              bus,
              journeyDate,
            }}
            className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur transition hover:bg-white/25"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Bus Details
          </Link>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Select Your Seats
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-bold">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 backdrop-blur">
                  <BusFront className="h-4 w-4" />
                  {bus.name}
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 backdrop-blur">
                  <MapPin className="h-4 w-4" />
                  {bus.source} → {bus.destination}
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 backdrop-blur">
                  <CalendarDays className="h-4 w-4" />
                  {formatJourneyDate(journeyDate)}
                </span>
              </div>
            </div>

            <div className="rounded-3xl bg-white/15 p-4 backdrop-blur">
              <p className="text-xs font-bold text-red-50">Starting Fare</p>

              <h2 className="text-3xl font-black">
                ₹{formatCurrency(seatPrice)}
              </h2>
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          {/* Bus Info Small Card */}
          <div className="mb-6 grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                Bus Type
              </p>
              <p className="mt-1 text-sm font-black text-slate-800">
                {bus.type}
              </p>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                Departure
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm font-black text-slate-800">
                <Clock3 className="h-4 w-4 text-red-600" />
                {bus.departure}
              </p>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                Arrival
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm font-black text-slate-800">
                <Clock3 className="h-4 w-4 text-red-600" />
                {bus.arrival}
              </p>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                Booked Seats
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm font-black text-slate-800">
                <Armchair className="h-4 w-4 text-red-600" />
                {bookedSeats.length}
              </p>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Seat Layout */}
            <div className="lg:col-span-2">
              <SeatLayout
                selectedSeats={selectedSeats}
                setSelectedSeats={setSelectedSeats}
                bookedSeats={bookedSeats}
                seatFare={seatPrice}
              />
            </div>

            {/* Summary */}
            <aside className="lg:col-span-1">
              <div className="sticky top-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="border-b border-slate-100 pb-4 text-xl font-black text-slate-900">
                  Booking Summary
                </h2>

                {/* Boarding */}
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">
                      Boarding Point
                    </label>

                    <select
                      value={selectedBoardingPoint}
                      onChange={(e) => setSelectedBoardingPoint(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10"
                    >
                      {bus.boardingPoints.length > 0 ? (
                        bus.boardingPoints.map((point) => (
                          <option key={point} value={point}>
                            {point}
                          </option>
                        ))
                      ) : (
                        <option value="">Boarding point not available</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">
                      Dropping Point
                    </label>

                    <select
                      value={selectedDroppingPoint}
                      onChange={(e) => setSelectedDroppingPoint(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10"
                    >
                      {bus.droppingPoints.length > 0 ? (
                        bus.droppingPoints.map((point) => (
                          <option key={point} value={point}>
                            {point}
                          </option>
                        ))
                      ) : (
                        <option value="">Dropping point not available</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Selected Seats */}
                <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-500">
                    Selected Seats
                  </p>

                  {sortedSelectedSeats.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {sortedSelectedSeats.map((seat) => (
                        <span
                          key={seat}
                          className="inline-flex items-center gap-1 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-black text-white"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {seat}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm font-semibold text-slate-400">
                      No seats selected
                    </p>
                  )}
                </div>

                {/* Fare */}
                <div className="mt-6 space-y-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Seat Fare</span>
                    <span className="font-black text-slate-800">
                      ₹{formatCurrency(seatPrice)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Seats</span>
                    <span className="font-black text-slate-800">
                      {selectedSeats.length}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Base Fare</span>
                    <span className="font-black text-slate-800">
                      ₹{formatCurrency(baseFare)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Platform Fee</span>
                    <span className="font-black text-slate-800">
                      ₹{formatCurrency(platformFee)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">GST (5%)</span>
                    <span className="font-black text-slate-800">
                      ₹{formatCurrency(gst)}
                    </span>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-700">
                        Total Amount
                      </span>

                      <span className="text-2xl font-black text-red-600">
                        ₹{formatCurrency(totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={selectedSeats.length === 0}
                  className={`mt-8 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-black transition ${
                    selectedSeats.length === 0
                      ? "cursor-not-allowed bg-slate-200 text-slate-400"
                      : "bg-red-600 text-white shadow-lg shadow-red-500/25 hover:bg-red-700 active:scale-[0.98]"
                  }`}
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  Safe & Secure Checkout
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
};

export default SeatSelection;
