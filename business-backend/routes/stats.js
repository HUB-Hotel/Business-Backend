const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Lodging = require("../models/Lodging");
const Room = require("../models/Room");
const Business = require("../models/Business");
const { authenticateToken } = require("../middlewares/auth");
const { requireBusiness } = require("../middlewares/roles");
const mongoose = require("mongoose");

// 모든 라우트는 인증 및 사업자 권한 필요
router.use(authenticateToken);
router.use(requireBusiness);

// 대시보드 통계
router.get("/dashboard", async (req, res) => {
  try {
    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    // 오늘 날짜 범위
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 기본 통계
    const lodgingIds = await Lodging.find({ business_id: business._id }).distinct('_id');
    
    const [totalLodgings, totalRooms, todayBookings, pendingBookings] = await Promise.all([
      Lodging.countDocuments({ business_id: business._id }),
      Room.countDocuments({ lodging_id: { $in: lodgingIds } }),
      Booking.countDocuments({
        business_id: business._id,
        createdAt: { $gte: today }
      }),
      Booking.countDocuments({
        business_id: business._id,
        booking_status: 'pending'
      })
    ]);

    // 매출 통계 (이번 달)
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    // 예약과 결제를 조인하여 매출 계산
    const bookings = await Booking.find({
      business_id: business._id,
      booking_status: { $in: ['confirmed', 'completed'] },
      createdAt: { $gte: thisMonthStart }
    }).select('_id').lean();

    const bookingIds = bookings.map(b => b._id);
    const payments = await Payment.find({
      booking_id: { $in: bookingIds }
    }).lean();

    const thisMonthRevenue = {
      total: payments.reduce((sum, p) => sum + (p.paid || 0), 0),
      count: bookings.length
    };

    // 이번 달 예약 추이 (일별)
    const dailyBookings = await Booking.aggregate([
      {
        $match: {
          business_id: business._id,
          createdAt: { $gte: thisMonthStart }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          bookingIds: { $push: '$_id' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 각 일별 예약의 결제 금액 계산
    const dailyBookingsWithRevenue = await Promise.all(
      dailyBookings.map(async (day) => {
        const payments = await Payment.find({
          booking_id: { $in: day.bookingIds }
        }).lean();
        const revenue = payments.reduce((sum, p) => sum + (p.paid || 0), 0);
        return {
          _id: day._id,
          count: day.count,
          revenue
        };
      })
    );

    // 호텔별 예약 수
    const hotelStats = await Booking.aggregate([
      {
        $match: {
          business_id: business._id,
          createdAt: { $gte: thisMonthStart }
        }
      },
      {
        $group: {
          _id: '$room_id',
          count: { $sum: 1 },
          bookingIds: { $push: '$_id' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // 각 호텔별 결제 금액 계산
    const hotelStatsWithRevenue = await Promise.all(
      hotelStats.map(async (stat) => {
        const payments = await Payment.find({
          booking_id: { $in: stat.bookingIds }
        }).lean();
        const revenue = payments.reduce((sum, p) => sum + (p.paid || 0), 0);
        return {
          _id: stat._id,
          count: stat.count,
          revenue
        };
      })
    );

    // 호텔 정보와 함께 조인
    const topRoomIds = hotelStatsWithRevenue.map(h => h._id);
    const rooms = await Room.find({ _id: { $in: topRoomIds } }).select('room_name').lean();
    const roomMap = {};
    rooms.forEach(r => { roomMap[r._id.toString()] = r.room_name; });

    const roomStatsWithNames = hotelStatsWithRevenue.map(stat => ({
      roomId: stat._id,
      roomName: roomMap[stat._id.toString()] || 'Unknown',
      count: stat.count,
      revenue: stat.revenue
    }));

    res.json({
      overview: {
        totalLodgings,
        totalRooms,
        todayBookings,
        pendingBookings,
        thisMonthRevenue: thisMonthRevenue.total || 0,
        thisMonthBookings: thisMonthRevenue.count || 0
      },
      dailyBookings: dailyBookingsWithRevenue,
      topRooms: roomStatsWithNames
    });
  } catch (error) {
    console.error("GET /api/stats/dashboard 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 통계 정보 (오늘/이번달 통계 및 변화율)
router.get("/statistics", async (req, res) => {
  try {
    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    // 날짜 범위 설정
    const now = new Date();
    
    // 오늘
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // 어제
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // 이번 달
    const thisMonthStart = new Date(now);
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    const thisMonthEnd = new Date(now);
    thisMonthEnd.setMonth(thisMonthEnd.getMonth() + 1);
    thisMonthEnd.setDate(0);
    thisMonthEnd.setHours(23, 59, 59, 999);
    
    // 지난 달
    const lastMonthStart = new Date(now);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    lastMonthStart.setDate(1);
    lastMonthStart.setHours(0, 0, 0, 0);
    const lastMonthEnd = new Date(now);
    lastMonthEnd.setDate(0);
    lastMonthEnd.setHours(23, 59, 59, 999);
    
    // 전년 동월
    const lastYearMonthStart = new Date(now);
    lastYearMonthStart.setFullYear(lastYearMonthStart.getFullYear() - 1);
    lastYearMonthStart.setDate(1);
    lastYearMonthStart.setHours(0, 0, 0, 0);
    const lastYearMonthEnd = new Date(lastYearMonthStart);
    lastYearMonthEnd.setMonth(lastYearMonthEnd.getMonth() + 1);
    lastYearMonthEnd.setDate(0);
    lastYearMonthEnd.setHours(23, 59, 59, 999);

    // 오늘 데이터 조회
    const todayBookings = await Booking.find({
      business_id: business._id,
      booking_status: { $in: ['confirmed', 'completed'] },
      createdAt: { $gte: today, $lt: tomorrow }
    }).select('_id').lean();

    const todayBookingIds = todayBookings.map(b => b._id);
    const todayPayments = await Payment.find({
      booking_id: { $in: todayBookingIds }
    }).lean();

    const todayRevenue = todayPayments.reduce((sum, p) => sum + (p.paid || 0), 0);
    const todayBookingsCount = todayBookings.length;

    // 어제 데이터 조회
    const yesterdayBookings = await Booking.find({
      business_id: business._id,
      booking_status: { $in: ['confirmed', 'completed'] },
      createdAt: { $gte: yesterday, $lt: today }
    }).select('_id').lean();

    const yesterdayBookingIds = yesterdayBookings.map(b => b._id);
    const yesterdayPayments = await Payment.find({
      booking_id: { $in: yesterdayBookingIds }
    }).lean();

    const yesterdayRevenue = yesterdayPayments.reduce((sum, p) => sum + (p.paid || 0), 0);
    const yesterdayBookingsCount = yesterdayBookings.length;

    // 오늘 변화율 계산
    const todayRevenueChange = yesterdayRevenue > 0 
      ? (todayRevenue - yesterdayRevenue) / yesterdayRevenue 
      : (todayRevenue > 0 ? 1 : 0);
    const todayBookingsChange = yesterdayBookingsCount > 0
      ? (todayBookingsCount - yesterdayBookingsCount) / yesterdayBookingsCount
      : (todayBookingsCount > 0 ? 1 : 0);

    // 이번 달 데이터 조회
    const thisMonthBookings = await Booking.find({
      business_id: business._id,
      booking_status: { $in: ['confirmed', 'completed'] },
      createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd }
    }).select('_id').lean();

    const thisMonthBookingIds = thisMonthBookings.map(b => b._id);
    const thisMonthPayments = await Payment.find({
      booking_id: { $in: thisMonthBookingIds }
    }).lean();

    const thisMonthRevenue = thisMonthPayments.reduce((sum, p) => sum + (p.paid || 0), 0);
    const thisMonthBookingsCount = thisMonthBookings.length;

    // 이번 달 취소 수
    const thisMonthCancellations = await Booking.countDocuments({
      business_id: business._id,
      booking_status: 'cancelled',
      createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd }
    });

    // 지난 달 데이터 조회
    const lastMonthBookings = await Booking.find({
      business_id: business._id,
      booking_status: { $in: ['confirmed', 'completed'] },
      createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
    }).select('_id').lean();

    const lastMonthBookingIds = lastMonthBookings.map(b => b._id);
    const lastMonthPayments = await Payment.find({
      booking_id: { $in: lastMonthBookingIds }
    }).lean();

    const lastMonthRevenue = lastMonthPayments.reduce((sum, p) => sum + (p.paid || 0), 0);

    // 지난 달 취소 수
    const lastMonthCancellations = await Booking.countDocuments({
      business_id: business._id,
      booking_status: 'cancelled',
      createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
    });

    // 이번 달 변화율 계산
    const thisMonthRevenueChange = lastMonthRevenue > 0
      ? (thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue
      : (thisMonthRevenue > 0 ? 1 : 0);
    const thisMonthCancellationsChange = lastMonthCancellations > 0
      ? (thisMonthCancellations - lastMonthCancellations) / lastMonthCancellations
      : (thisMonthCancellations > 0 ? 1 : 0);

    // 전년 동월 데이터 조회
    const lastYearMonthBookings = await Booking.find({
      business_id: business._id,
      booking_status: { $in: ['confirmed', 'completed'] },
      createdAt: { $gte: lastYearMonthStart, $lte: lastYearMonthEnd }
    }).select('_id').lean();

    const lastYearMonthBookingIds = lastYearMonthBookings.map(b => b._id);
    const lastYearMonthPayments = await Payment.find({
      booking_id: { $in: lastYearMonthBookingIds }
    }).lean();

    const lastYearMonthRevenue = lastYearMonthPayments.reduce((sum, p) => sum + (p.paid || 0), 0);

    // YoY 변화율 계산
    const yoyChange = lastYearMonthRevenue > 0
      ? (thisMonthRevenue - lastYearMonthRevenue) / lastYearMonthRevenue
      : (thisMonthRevenue > 0 ? 1 : 0);

    res.json({
      today: {
        revenue: todayRevenue,
        bookings: todayBookingsCount,
        change: {
          revenue: todayRevenueChange,
          bookings: todayBookingsChange
        }
      },
      thisMonth: {
        revenue: thisMonthRevenue,
        bookings: thisMonthBookingsCount,
        cancellations: thisMonthCancellations,
        change: {
          revenue: thisMonthRevenueChange,
          cancellations: thisMonthCancellationsChange
        }
      },
      trendComparison: {
        current: thisMonthRevenue,
        previous: lastMonthRevenue,
        yoyChange: yoyChange
      }
    });
  } catch (error) {
    console.error("GET /api/stats/statistics 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 매출 통계 (기간별)
router.get("/revenue", async (req, res) => {
  try {
    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const { startDate, endDate, groupBy = 'day' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "시작일과 종료일이 필요합니다." });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    let dateFormat = '%Y-%m-%d';
    if (groupBy === 'month') {
      dateFormat = '%Y-%m';
    } else if (groupBy === 'year') {
      dateFormat = '%Y';
    }

    const bookings = await Booking.find({
      business_id: business._id,
      booking_status: { $in: ['confirmed', 'completed'] },
      createdAt: { $gte: start, $lte: end }
    }).select('_id createdAt').lean();

    const bookingIds = bookings.map(b => b._id);
    const payments = await Payment.find({
      booking_id: { $in: bookingIds }
    }).lean();

    // 예약 ID로 결제 매핑
    const paymentMap = {};
    payments.forEach(p => {
      paymentMap[p.booking_id.toString()] = p.paid || 0;
    });

    // 날짜별로 그룹화
    const revenueMap = {};
    bookings.forEach(b => {
      const dateKey = groupBy === 'month' 
        ? b.createdAt.toISOString().substring(0, 7)
        : groupBy === 'year'
        ? b.createdAt.toISOString().substring(0, 4)
        : b.createdAt.toISOString().substring(0, 10);
      
      if (!revenueMap[dateKey]) {
        revenueMap[dateKey] = { totalRevenue: 0, bookingCount: 0 };
      }
      revenueMap[dateKey].totalRevenue += paymentMap[b._id.toString()] || 0;
      revenueMap[dateKey].bookingCount += 1;
    });

    const revenue = Object.entries(revenueMap).map(([date, data]) => ({
      _id: date,
      totalRevenue: data.totalRevenue,
      bookingCount: data.bookingCount,
      averagePrice: data.bookingCount > 0 ? data.totalRevenue / data.bookingCount : 0
    })).sort((a, b) => a._id.localeCompare(b._id));

    res.json({ revenue });
  } catch (error) {
    console.error("GET /api/stats/revenue 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 매출 추이 통계 (기간별)
router.get("/revenue-stats", async (req, res) => {
  try {
    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const { period = "month" } = req.query;
    
    if (!["week", "month", "quarter", "year"].includes(period)) {
      return res.status(400).json({ message: "유효하지 않은 기간입니다. week, month, quarter, year 중 하나를 선택하세요." });
    }

    const now = new Date();
    let startDate, endDate, periods, labels, dateFormat;

    // 기간별 날짜 범위 및 레이블 설정
    switch (period) {
      case "week": {
        // 최근 4주
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 28); // 4주 전
        startDate.setHours(0, 0, 0, 0);
        
        periods = [];
        labels = [];
        for (let i = 3; i >= 0; i--) {
          const weekEnd = new Date(now);
          weekEnd.setDate(weekEnd.getDate() - (i * 7));
          const weekStart = new Date(weekEnd);
          weekStart.setDate(weekStart.getDate() - 6);
          weekStart.setHours(0, 0, 0, 0);
          weekEnd.setHours(23, 59, 59, 999);
          
          periods.push({ start: weekStart, end: weekEnd });
          labels.push(`${4 - i}주`);
        }
        break;
      }
      case "month": {
        // 최근 12개월
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 11);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        
        periods = [];
        labels = [];
        for (let i = 11; i >= 0; i--) {
          const monthDate = new Date(now);
          monthDate.setMonth(monthDate.getMonth() - i);
          const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
          monthStart.setHours(0, 0, 0, 0);
          const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
          monthEnd.setHours(23, 59, 59, 999);
          
          periods.push({ start: monthStart, end: monthEnd });
          labels.push(`${monthDate.getMonth() + 1}월`);
        }
        break;
      }
      case "quarter": {
        // 최근 4분기
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 12); // 4분기 전
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        
        periods = [];
        labels = [];
        for (let i = 3; i >= 0; i--) {
          const quarterDate = new Date(now);
          quarterDate.setMonth(quarterDate.getMonth() - (i * 3));
          const quarter = Math.floor(quarterDate.getMonth() / 3);
          const quarterStart = new Date(quarterDate.getFullYear(), quarter * 3, 1);
          quarterStart.setHours(0, 0, 0, 0);
          const quarterEnd = new Date(quarterDate.getFullYear(), (quarter + 1) * 3, 0);
          quarterEnd.setHours(23, 59, 59, 999);
          
          periods.push({ start: quarterStart, end: quarterEnd });
          labels.push(`${quarterDate.getFullYear()}년 ${quarter + 1}분기`);
        }
        break;
      }
      case "year": {
        // 최근 5년
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(endDate);
        startDate.setFullYear(startDate.getFullYear() - 4);
        startDate.setMonth(0);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        
        periods = [];
        labels = [];
        for (let i = 4; i >= 0; i--) {
          const yearDate = new Date(now);
          yearDate.setFullYear(yearDate.getFullYear() - i);
          const yearStart = new Date(yearDate.getFullYear(), 0, 1);
          yearStart.setHours(0, 0, 0, 0);
          const yearEnd = new Date(yearDate.getFullYear(), 11, 31);
          yearEnd.setHours(23, 59, 59, 999);
          
          periods.push({ start: yearStart, end: yearEnd });
          labels.push(`${yearDate.getFullYear()}년`);
        }
        break;
      }
    }

    // 각 기간별 데이터 조회
    const revenueData = [];
    const bookingsData = [];

    for (const periodRange of periods) {
      const bookings = await Booking.find({
        business_id: business._id,
        booking_status: { $in: ['confirmed', 'completed'] },
        createdAt: { $gte: periodRange.start, $lte: periodRange.end }
      }).select('_id').lean();

      const bookingIds = bookings.map(b => b._id);
      const payments = await Payment.find({
        booking_id: { $in: bookingIds }
      }).lean();

      const revenue = payments.reduce((sum, p) => sum + (p.paid || 0), 0);
      const bookingsCount = bookings.length;

      revenueData.push(revenue);
      bookingsData.push(bookingsCount);
    }

    res.json({
      labels: labels,
      revenue: revenueData,
      bookings: bookingsData
    });
  } catch (error) {
    console.error("GET /api/stats/revenue-stats 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

module.exports = router;

