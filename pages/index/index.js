// pages/index/index.js
Page({
  data: {
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
    isLoggedIn: false,
    isAdmin: false,
    currentTime: '',
    greeting: '',
    storeStatus: {
      isOpen: false,
      openTime: '',
      closeTime: '',
      lastUpdate: ''
    },
    todayActivities: [],
    recommendedActivities: []
  },

  onLoad() {
    this.updateTime();
    this.loadStoreStatus();
    this.loadActivities();
    this.loadUserStatus();
    this.startTimeUpdate();
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.loadStoreStatus();
    this.loadActivities();
    this.loadUserStatus();
    this.updateGreeting();
  },

  onHide() {
    if (this.timeTimer) {
      clearInterval(this.timeTimer);
    }
  },

  onUnload() {
    if (this.timeTimer) {
      clearInterval(this.timeTimer);
    }
  },

  // 更新时间和问候语
  updateTime() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;

    this.setData({
      currentTime: timeString
    });

    this.updateGreeting();
  },

  // 更新问候语
  updateGreeting() {
    const now = new Date();
    const hours = now.getHours();
    let greeting = '';

    if (hours < 6) {
      greeting = '夜深了，注意休息';
    } else if (hours < 12) {
      greeting = '早上好';
    } else if (hours < 14) {
      greeting = '中午好';
    } else if (hours < 18) {
      greeting = '下午好';
    } else if (hours < 22) {
      greeting = '晚上好';
    } else {
      greeting = '夜深了，注意休息';
    }

    this.setData({
      greeting
    });
  },

  // 开始时间更新定时器
  startTimeUpdate() {
    this.updateTime();
    this.timeTimer = setInterval(() => {
      this.updateTime();
    }, 60000); // 每分钟更新一次
  },

  // 加载用户状态
  loadUserStatus() {
    const app = getApp();
    const userInfo = app.getUserInfo();
    this.setData({
      userInfo: userInfo || {},
      isLoggedIn: app.globalData.isLoggedIn || false,
      isAdmin: app.getIsAdmin() || false
    });
  },

  // 加载店铺状态
  loadStoreStatus() {
    const app = getApp();
    const storeStatus = app.globalData.storeStatus || wx.getStorageSync('storeStatus');
    this.setData({ storeStatus });
  },

  // 加载活动数据
  loadActivities() {
    const activities = wx.getStorageSync('activities') || [];
    const today = new Date().toDateString();

    // 筛选今天的活动
    const todayActivities = activities.filter(activity => {
      return new Date(activity.date).toDateString() === today;
    });

    // 推荐活动（人数不足的）
    const recommendedActivities = activities.filter(activity => {
      return activity.currentPlayers < activity.maxPlayers &&
             new Date(activity.date) >= new Date();
    }).slice(0, 3);

    this.setData({
      todayActivities,
      recommendedActivities
    });
  },

  // 跳转到店铺状态页面
  goToStoreStatus() {
    wx.navigateTo({
      url: '/pages/store-status/store-status'
    });
  },

  // 跳转到活动列表
  goToActivityList() {
    wx.switchTab({
      url: '/pages/activity-list/activity-list'
    });
  },

  // 跳转到创建活动
  goToCreateActivity() {
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      wx.navigateTo({
        url: '/pages/login/login'
      });
      return;
    }
    wx.navigateTo({
      url: '/pages/activity/activity'
    });
  },

  // 跳转到用户中心页面
  goToMemberCard() {
    wx.switchTab({
      url: '/pages/member/member'
    });
  },

  // 搜索功能
  goToSearch() {
    wx.showToast({
      title: '搜索功能开发中',
      icon: 'none'
    });
  },

  // 更多功能
  goToMore() {
    wx.showActionSheet({
      itemList: ['关于我们', '意见反馈', '分享小程序'],
      success(res) {
        switch (res.tapIndex) {
        case 0:
          wx.showToast({
            title: '关于我们功能开发中',
            icon: 'none'
          });
          break;
        case 1:
          wx.showToast({
            title: '意见反馈功能开发中',
            icon: 'none'
          });
          break;
        case 2:
          wx.showShareMenu({
            withShareTicket: true,
            menus: ['shareAppMessage', 'shareTimeline']
          });
          break;
        }
      }
    });
  },

  // 跳转到活动详情
  goToActivityDetail(e) {
    const activityId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/activity-detail/activity-detail?id=${activityId}`
    });
  },

  // ==================== 管理员功能 ====================

  // 跳转到店铺状态管理
  goToStoreStatusManagement() {
    wx.navigateTo({
      url: '/pages/store-status/store-status'
    });
  },

  // 跳转到用户管理
  goToMemberManagement() {
    wx.navigateTo({
      url: '/pages/admin-management/admin-management'
    });
  },

  // 跳转到财务报告（开发中）
  goToFinancialReport() {
    wx.showToast({
      title: '功能开发中...',
      icon: 'none'
    });
  },

  // 跳转到系统设置（开发中）
  goToSystemSettings() {
    wx.showToast({
      title: '功能开发中...',
      icon: 'none'
    });
  }
});
