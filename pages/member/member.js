// pages/member/member.js
Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    balance: 0,
    transactionHistory: [],
    isLoading: false
  },

  onLoad() {
    this.loadMemberInfo();
  },

  onShow() {
    this.loadMemberInfo();
  },

  // 加载用户信息
  async loadMemberInfo() {
    const app = getApp();

    if (app.globalData.isLoggedIn) {
      this.setData({ isLoading: true });

      const userInfo = app.globalData.userInfo;
      let memberCard = null;
      let transactions = [];

      try {
        // 如果云数据库连接成功，优先使用云数据库
        if (app.globalData.isCloudConnected && app.globalData.dbManager) {
          // 获取会员卡信息
          memberCard = await app.globalData.dbManager.getMemberCard(userInfo.phone);

          // 获取交易记录
          transactions = await app.globalData.dbManager.getUserTransactions(userInfo.phone);
        } else {
          // 降级到本地存储
          const members = wx.getStorageSync('members') || [];
          const member = members.find(m => m.phone === userInfo.phone);

          memberCard = member ? {
            phone: member.phone,
            balance: member.balance,
            level: member.level || 1,
            totalSpent: member.totalSpent || 0
          } : null;

          transactions = member ? member.transactions || [] : [];
        }
      } catch (error) {
        console.error('加载会员信息失败:', error);
        wx.showToast({
          title: '数据加载失败',
          icon: 'error'
        });
      }

      this.setData({
        userInfo,
        isLoggedIn: true,
        balance: memberCard ? memberCard.balance : 0,
        transactionHistory: transactions,
        isLoading: false
      });
    } else {
      this.setData({
        userInfo: null,
        isLoggedIn: false,
        balance: 0,
        transactionHistory: [],
        isLoading: false
      });
    }
  },

  // 充值功能已移除，只保留余额显示

  // 处理充值（已取消）
  processRecharge(amount) {
    // 充值功能已取消，此方法不再使用
    wx.showToast({
      title: '充值功能已关闭',
      icon: 'none'
    });
  },

  // 返回首页
  goToHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 跳转到登录页面
  goToLogin() {
    wx.navigateTo({
      url: '/pages/login/login?from=member'
    });
  },

  // 退出账号
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      confirmText: '退出',
      confirmColor: '#ff4757',
      success: (res) => {
        if (res.confirm) {
          const app = getApp();

          // 清除全局登录状态
          app.globalData.isLoggedIn = false;
          app.globalData.userInfo = null;
          app.globalData.isAdmin = false;

          // 清除本地存储的登录信息
          wx.removeStorageSync('isLoggedIn');
          wx.removeStorageSync('userInfo');

          // 更新页面状态
          this.setData({
            userInfo: null,
            isLoggedIn: false,
            balance: 0,
            transactionHistory: []
          });

          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 2000
          });
        }
      }
    });
  },

  // 查看交易详情
  viewTransactionDetail(e) {
    const transaction = e.currentTarget.dataset.transaction;

    wx.showModal({
      title: '交易详情',
      content: `类型：${transaction.type}\n金额：¥${transaction.amount.toFixed(2)}\n时间：${transaction.date}\n余额：¥${transaction.balance.toFixed(2)}`,
      showCancel: false,
      confirmText: '确定'
    });
  },

  // 返回首页
  goToHome() {
    wx.switchTab({
      url: '/pages/index/index'
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
      success: (res) => {
        switch (res.tapIndex) {
        case 0:
          wx.showToast({
            title: '关于我们',
            icon: 'none'
          });
          break;
        case 1:
          wx.showToast({
            title: '意见反馈',
            icon: 'none'
          });
          break;
        case 2:
          wx.showToast({
            title: '分享小程序',
            icon: 'none'
          });
          break;
        }
      }
    });
  },

  // 快速充值（已取消）
  quickRecharge(e) {
    // 充值功能已取消
    wx.showToast({
      title: '充值功能已关闭',
      icon: 'none'
    });
  }
});
