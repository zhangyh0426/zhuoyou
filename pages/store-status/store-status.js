// pages/store-status/store-status.js
Page({
  data: {
    storeStatus: {
      isOpen: false,
      openTime: '',
      closeTime: '',
      lastUpdate: '',
    },
    isAdmin: false, // 管理员权限（普通管理员和超级管理员）
    userInfo: null,
    userRole: '', // 用户角色显示
    currentTime: '', // 当前时间
  },

  onLoad() {
    this.loadStoreStatus();
    this.checkAdminPermission();
    this.updateTime();
    this.startTimeUpdate();
  },

  onShow() {
    this.loadStoreStatus();
    this.updateTime();
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
  },

  // 开始时间更新定时器
  startTimeUpdate() {
    this.updateTime();
    this.timeTimer = setInterval(() => {
      this.updateTime();
    }, 60000); // 每分钟更新一次
  },

  // 返回首页
  goToIndex() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 加载店铺状态
  loadStoreStatus() {
    const app = getApp();
    const storeStatus = app.globalData.storeStatus ||
      wx.getStorageSync('storeStatus') || {
        isOpen: false,
        openTime: '',
        closeTime: '',
        lastUpdate: '',
      };
    this.setData({ storeStatus });
  },

  // 检查管理员权限
  checkAdminPermission() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;

    // 使用动态管理员验证，而不是硬编码手机号
    const isAdmin = app.getIsAdmin();

    // 检查用户角色（普通管理员或超级管理员）
    const userRole = app.getUserRole(userInfo?.phone, userInfo?.name);
    const canManageStore = isAdmin && (userRole === 'normal' || userRole === 'super');

    // 设置角色显示文本
    let roleText = '';
    if (userRole === 'super') {
      roleText = '超级管理员';
    } else if (userRole === 'normal') {
      roleText = '管理员';
    }

    this.setData({
      userInfo,
      isAdmin: canManageStore,
      userRole: roleText,
    });
  },

  // 切换店铺状态
  toggleStoreStatus() {
    const { isAdmin, storeStatus } = this.data;

    if (!isAdmin) {
      wx.showToast({
        title: '只有管理员才能操作',
        icon: 'none',
      });
      return;
    }

    // 添加确认对话框
    const action = storeStatus.isOpen ? '打烊' : '开业';
    wx.showModal({
      title: '确认操作',
      content: `确定要将店铺${action}吗？`,
      confirmText: '确定',
      cancelText: '取消',
      success: res => {
        if (res.confirm) {
          this.performStoreStatusToggle();
        }
      },
    });
  },

  // 执行店铺状态切换
  performStoreStatusToggle() {
    const { storeStatus } = this.data;

    // 显示加载状态
    wx.showLoading({
      title: '处理中...',
      mask: true,
    });

    // 模拟处理时间，增加用户体验
    setTimeout(() => {
      const newStatus = {
        ...storeStatus,
        isOpen: !storeStatus.isOpen,
        lastUpdate: new Date().toLocaleString(),
      };

      // 更新全局状态
      const app = getApp();
      app.updateStoreStatus(newStatus);

      this.setData({
        storeStatus: newStatus,
      });

      wx.hideLoading();

      // 显示成功动画
      this.showSuccessAnimation(newStatus.isOpen);

      wx.showToast({
        title: newStatus.isOpen ? '店铺已开业' : '店铺已打烊',
        icon: 'success',
        duration: 2000,
      });
    }, 500);
  },

  // 显示成功动画
  showSuccessAnimation(isOpen) {
    // 添加按钮动画效果
    this.setData({
      animationClass: isOpen ? 'open-animation' : 'close-animation',
    });

    // 清除动画类
    setTimeout(() => {
      this.setData({
        animationClass: '',
      });
    }, 1000);
  },

  // 设置营业时间
  setBusinessHours() {
    const { isAdmin } = this.data;

    if (!isAdmin) {
      wx.showToast({
        title: '只有管理员才能操作',
        icon: 'none',
      });
      return;
    }

    // 这里可以添加设置营业时间的逻辑
    wx.showToast({
      title: '功能开发中',
      icon: 'none',
    });
  },

  // 查看营业记录
  viewStoreHistory() {
    const { isAdmin } = this.data;

    if (!isAdmin) {
      wx.showToast({
        title: '只有管理员才能操作',
        icon: 'none',
      });
      return;
    }

    // 这里可以添加查看营业记录的逻辑
    wx.showToast({
      title: '功能开发中',
      icon: 'none',
    });
  },
});
