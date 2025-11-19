// pages/activity/activity.js
Page({
  data: {
    activity: {
      title: '',
      date: '',
      time: '',
      maxPlayers: 12,
      description: '',
      currentPlayers: 0,
      participants: []
    },
    userInfo: null,
    isCreating: true
  },

  onLoad(options) {
    const app = getApp();
    this.setData({
      userInfo: app.globalData.userInfo
    });

    // 设置默认日期为今天
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    const timeString = '19:00';

    this.setData({
      'activity.date': dateString,
      'activity.time': timeString
    });
  },

  // 输入活动标题
  onTitleInput(e) {
    this.setData({
      'activity.title': e.detail.value
    });
  },

  // 选择日期
  onDateChange(e) {
    this.setData({
      'activity.date': e.detail.value
    });
  },

  // 选择时间
  onTimeChange(e) {
    this.setData({
      'activity.time': e.detail.value
    });
  },

  // 输入最大人数
  onMaxPlayersInput(e) {
    this.setData({
      'activity.maxPlayers': parseInt(e.detail.value) || 0
    });
  },

  // 输入活动描述
  onDescriptionInput(e) {
    this.setData({
      'activity.description': e.detail.value
    });
  },

  // 创建活动
  createActivity() {
    const { activity, userInfo } = this.data;

    // 验证输入
    if (!activity.title) {
      wx.showToast({
        title: '请输入活动标题',
        icon: 'none'
      });
      return;
    }

    if (!activity.date) {
      wx.showToast({
        title: '请选择日期',
        icon: 'none'
      });
      return;
    }

    if (!activity.time) {
      wx.showToast({
        title: '请选择时间',
        icon: 'none'
      });
      return;
    }

    if (activity.maxPlayers < 4) {
      wx.showToast({
        title: '最少需要4人',
        icon: 'none'
      });
      return;
    }

    if (activity.maxPlayers > 20) {
      wx.showToast({
        title: '最多支持20人',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '创建中...'
    });

    // 创建活动对象
    const newActivity = {
      id: Date.now(),
      ...activity,
      creator: userInfo,
      createdAt: new Date().toLocaleString(),
      participants: [userInfo] // 创建者自动加入
    };

    // 更新当前人数
    newActivity.currentPlayers = newActivity.participants.length;

    // 保存到本地存储
    const activities = wx.getStorageSync('activities') || [];
    activities.unshift(newActivity);
    wx.setStorageSync('activities', activities);

    wx.hideLoading();
    wx.showToast({
      title: '活动创建成功',
      icon: 'success'
    });

    // 跳转到活动列表
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/activity-list/activity-list'
      });
    }, 1500);
  }
});
