// pages/activity-list/activity-list.js
Page({
  data: {
    activities: [],
    filteredActivities: [],
    userInfo: null,
    activeTab: 'all', // all, today, upcoming
    currentTime: '',
    isLoading: false,
    hasMoreActivities: true,
    isCloudConnected: false
  },

  onLoad() {
    this.updateCurrentTime();
    this.loadActivities();
    this.updateFilteredActivities();
    // 每分钟更新时间
    setInterval(() => {
      this.updateCurrentTime();
    }, 60000);
  },

  onShow() {
    this.loadActivities();
    this.updateFilteredActivities();
  },

  // 加载活动数据
  async loadActivities() {
    this.setData({ isLoading: true });

    const app = getApp();
    let activities = [];

    try {
      // 检查云数据库连接状态
      this.setData({ isCloudConnected: app.globalData.isCloudConnected });

      // 如果云数据库连接成功，优先使用云数据库
      if (app.globalData.isCloudConnected && app.globalData.dbManager) {
        activities = await app.globalData.dbManager.getActivities();
        console.log('从云数据库加载活动:', activities.length);
      } else {
        // 降级到本地存储
        activities = wx.getStorageSync('activities') || [];
        console.log('从本地存储加载活动:', activities.length);
      }
    } catch (error) {
      console.error('加载活动数据失败:', error);

      // 出错时尝试使用本地存储
      try {
        activities = wx.getStorageSync('activities') || [];
        console.log('备用方案：从本地存储加载活动:', activities.length);

        wx.showToast({
          title: '数据同步失败，使用本地数据',
          icon: 'none',
          duration: 2000
        });
      } catch (localError) {
        console.error('本地存储也失败:', localError);
        activities = [];
      }
    }

    this.setData({
      activities,
      userInfo: app.globalData.userInfo,
      isLoading: false
    });

    // 更新筛选后的活动列表
    this.updateFilteredActivities();
  },

  // 切换标签页
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
    this.updateFilteredActivities();
  },

  // 更新筛选后的活动列表
  updateFilteredActivities() {
    const { activities, activeTab } = this.data;
    let filteredActivities = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (activeTab) {
    case 'today':
      filteredActivities = activities.filter(activity => {
        const activityDate = new Date(activity.date);
        activityDate.setHours(0, 0, 0, 0);
        return activityDate.getTime() === today.getTime();
      });
      break;
    case 'upcoming':
      filteredActivities = activities.filter(activity => {
        const activityDate = new Date(activity.date);
        activityDate.setHours(0, 0, 0, 0);
        return activityDate.getTime() > today.getTime();
      });
      break;
    default:
      filteredActivities = activities;
    }

    this.setData({
      filteredActivities
    });
  },

  // 获取筛选后的活动列表
  getFilteredActivities() {
    const { activities, activeTab } = this.data;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (activeTab) {
    case 'today':
      return activities.filter(activity => {
        const activityDate = new Date(activity.date);
        activityDate.setHours(0, 0, 0, 0);
        return activityDate.getTime() === today.getTime();
      });
    case 'upcoming':
      return activities.filter(activity => {
        const activityDate = new Date(activity.date);
        activityDate.setHours(0, 0, 0, 0);
        return activityDate.getTime() > today.getTime();
      });
    default:
      return activities;
    }
  },

  // 计算今日活动
  isTodayActivity(date) {
    const activityDate = new Date(date);
    const today = new Date();
    activityDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return activityDate.getTime() === today.getTime();
  },

  // 计算即将到来的活动
  isUpcomingActivity(date) {
    const activityDate = new Date(date);
    const today = new Date();
    activityDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return activityDate.getTime() > today.getTime();
  },

  // 报名参加活动
  async joinActivity(e) {
    const activityId = e.currentTarget.dataset.id;
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

    const userInfo = app.globalData.userInfo;
    const activities = [...this.data.activities];
    const activityIndex = activities.findIndex(item => item.id === activityId);

    if (activityIndex === -1) {
      wx.showToast({
        title: '活动不存在',
        icon: 'none'
      });
      return;
    }

    const activity = activities[activityIndex];

    // 检查是否已经报名
    const isJoined = activity.participants.some(participant =>
      participant.phone === userInfo.phone
    );

    if (isJoined) {
      wx.showToast({
        title: '您已报名',
        icon: 'none'
      });
      return;
    }

    // 检查人数是否已满
    if (activity.currentPlayers >= activity.maxPlayers) {
      wx.showToast({
        title: '人数已满',
        icon: 'none'
      });
      return;
    }

    try {
      let success = false;

      // 如果云数据库连接成功，优先使用云数据库
      if (app.globalData.isCloudConnected && app.globalData.dbManager) {
        success = await app.globalData.dbManager.joinActivity(activityId, userInfo.phone);
        console.log('云数据库报名结果:', success);
      } else {
        // 降级到本地存储
        success = this.joinActivityLocal(activityId, userInfo, activities);
        console.log('本地存储报名结果:', success);
      }

      if (success) {
        // 重新加载活动数据
        await this.loadActivities();

        wx.showToast({
          title: '报名成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: '报名失败，请重试',
          icon: 'error'
        });
      }
    } catch (error) {
      console.error('报名过程出错:', error);
      wx.showToast({
        title: '报名失败',
        icon: 'error'
      });
    }
  },

  // 本地存储报名方法（降级方案）
  joinActivityLocal(activityId, userInfo, activities) {
    try {
      const activityIndex = activities.findIndex(item => item.id === activityId);

      if (activityIndex === -1) {
        return false;
      }

      const activity = activities[activityIndex];

      // 再次检查防止重复报名
      const isJoined = activity.participants.some(participant =>
        participant.phone === userInfo.phone
      );

      if (isJoined) {
        return false;
      }

      // 检查人数是否已满
      if (activity.currentPlayers >= activity.maxPlayers) {
        return false;
      }

      // 添加参与者
      activity.participants.push(userInfo);
      activity.currentPlayers = activity.participants.length;

      // 更新本地存储
      wx.setStorageSync('activities', activities);

      // 更新页面数据
      this.setData({
        activities
      });

      return true;
    } catch (error) {
      console.error('本地报名失败:', error);
      return false;
    }
  },

  // 查看活动详情
  viewActivityDetail(e) {
    const activityId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/activity-detail/activity-detail?id=${activityId}`
    });
  },

  // 更新当前时间
  updateCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    this.setData({
      currentTime: `${hours}:${minutes}`
    });
  },

  // 跳转到搜索页面
  goToSearch() {
    wx.showToast({
      title: '搜索功能开发中',
      icon: 'none'
    });
  },

  // 跳转到创建活动页面
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
      url: '/pages/create-activity/create-activity'
    });
  }
});
