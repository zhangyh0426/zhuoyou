// pages/login/login.js
Page({
  data: {
    phoneNumber: '',
    memberName: '',
    isNewMember: false,
    memberCard: null
  },

  onLoad(options) {
    // 检查是否从用户中心页面跳转过来
    if (options.from === 'member') {
      this.setData({ isNewMember: true });
    }
  },

  // 输入手机号
  onPhoneInput(e) {
    this.setData({
      phoneNumber: e.detail.value
    });
  },

  // 输入姓名
  onNameInput(e) {
    this.setData({
      memberName: e.detail.value
    });
  },

  // 验证手机号格式
  validatePhone(phone) {
    const phoneReg = /^1[3-9]\d{9}$/;
    return phoneReg.test(phone);
  },

  // 登录/注册
  handleLogin() {
    const { phoneNumber, memberName, isNewMember } = this.data;

    // 验证输入
    if (!phoneNumber) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'none'
      });
      return;
    }

    if (!this.validatePhone(phoneNumber)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }

    if (!memberName) {
      wx.showToast({
        title: '请输入姓名',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '登录中...'
    });

    // 模拟登录过程
    setTimeout(() => {
      this.completeLogin();
    }, 1000);
  },

  // 完成登录
  completeLogin() {
    const app = getApp();
    const { phoneNumber, memberName, isNewMember } = this.data;

    // 创建或获取用户信息
    const userInfo = {
      phone: phoneNumber,
      name: memberName,
      loginTime: new Date().toLocaleString()
    };

    // 处理用户卡
    let memberCard = wx.getStorageSync(`member_${phoneNumber}`);
    if (!memberCard) {
      memberCard = {
        phone: phoneNumber,
        name: memberName,
        balance: isNewMember ? 0 : Math.floor(Math.random() * 500) + 100, // 模拟余额
        points: 0,
        level: '用户',
        createTime: new Date().toLocaleString()
      };
      wx.setStorageSync(`member_${phoneNumber}`, memberCard);
    }

    // 使用app.setUserInfo统一处理登录状态
    app.setUserInfo(userInfo);
    app.globalData.memberCard = memberCard;
    wx.setStorageSync('memberCard', memberCard);

    wx.hideLoading();

    // 检查管理员身份并显示相应提示
    const isAdmin = app.getIsAdmin();
    if (isAdmin) {
      wx.showToast({
        title: '管理员登录成功',
        icon: 'success'
      });
    } else {
      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });
    }

    // 跳转到相应页面
    setTimeout(() => {
      if (isNewMember) {
        wx.switchTab({
          url: '/pages/member/member'
        });
      } else {
        wx.navigateBack();
      }
    }, 1500);
  }

});
