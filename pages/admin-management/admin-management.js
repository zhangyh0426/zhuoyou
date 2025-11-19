// pages/admin-management/admin-management.js
const app = getApp();

Page({
  data: {
    adminList: [],
    currentAdmin: {},
    formData: {
      name: '',
      phone: '',
      role: 'normal'
    },
    roleOptions: [
      { value: 'normal', label: '普通管理员' },
      { value: 'super', label: '超级管理员' }
    ],
    roleIndex: 0,
    editingIndex: -1
  },

  onLoad() {
    this.loadCurrentAdmin();
    this.loadAdminList();
  },

  onShow() {
    this.loadAdminList();
  },

  // 加载当前管理员信息
  loadCurrentAdmin() {
    const currentAdmin = app.getUserInfo();
    if (!currentAdmin || !app.isAdminUser(currentAdmin.phone, currentAdmin.name)) {
      wx.showToast({
        title: '非管理员无法访问此页面',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }
    this.setData({ currentAdmin });
  },

  // 加载管理员列表
  loadAdminList() {
    const adminList = app.getAdminList() || [];
    this.setData({ adminList });
  },

  // 角色选择变化
  onRoleChange(e) {
    const roleIndex = parseInt(e.detail.value);
    const role = this.data.roleOptions[roleIndex].value;
    this.setData({
      roleIndex,
      'formData.role': role
    });
  },

  // 编辑管理员
  editAdmin(e) {
    const index = e.currentTarget.dataset.index;
    const admin = this.data.adminList[index];

    this.setData({
      editingIndex: index,
      formData: {
        name: admin.name,
        phone: admin.phone,
        role: admin.role
      },
      roleIndex: this.data.roleOptions.findIndex(option => option.value === admin.role)
    });
  },

  // 删除管理员
  deleteAdmin(e) {
    const index = e.currentTarget.dataset.index;
    const admin = this.data.adminList[index];

    wx.showModal({
      title: '确认删除',
      content: `确定要删除管理员"${admin.name}"吗？`,
      success: (res) => {
        if (res.confirm) {
          const success = app.removeAdmin(admin.phone);
          if (success) {
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });
            this.loadAdminList();
          } else {
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            });
          }
        }
      }
    });
  },

  // 重置表单
  resetForm() {
    this.setData({
      formData: {
        name: '',
        phone: '',
        role: 'normal'
      },
      roleIndex: 0,
      editingIndex: -1
    });
  },

  // 提交表单
  submitForm(e) {
    const formData = e.detail.value;

    // 表单验证
    if (!formData.name.trim()) {
      wx.showToast({
        title: '请输入管理员姓名',
        icon: 'none'
      });
      return;
    }

    if (!formData.phone.trim()) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'none'
      });
      return;
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }

    const adminData = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      role: formData.role
    };

    let success = false;

    if (this.data.editingIndex >= 0) {
      // 编辑模式
      success = app.updateAdmin(adminData);
      if (success) {
        wx.showToast({
          title: '更新成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: '更新失败',
          icon: 'error'
        });
      }
    } else {
      // 添加模式
      // 检查手机号是否已存在
      if (this.data.adminList.some(admin => admin.phone === adminData.phone)) {
        wx.showToast({
          title: '该手机号已是管理员',
          icon: 'none'
        });
        return;
      }

      success = app.addAdmin(adminData);
      if (success) {
        wx.showToast({
          title: '添加成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: '添加失败',
          icon: 'error'
        });
      }
    }

    if (success) {
      this.resetForm();
      this.loadAdminList();
    }
  },

  // 导出管理员数据
  exportAdminData() {
    const adminList = app.getAdminList() || [];
    const dataStr = JSON.stringify(adminList, null, 2);

    wx.setClipboardData({
      data: dataStr,
      success: () => {
        wx.showToast({
          title: '数据已复制到剪贴板',
          icon: 'success'
        });
      }
    });
  },

  // 导入管理员数据
  importAdminData() {
    wx.showModal({
      title: '导入数据',
      content: '请在下一个页面粘贴管理员数据JSON',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: '/pages/activity-list/activity-list'
          });
          // TODO: 实现数据导入逻辑
        }
      }
    });
  },

  // 备份所有数据
  backupAllData() {
    const allData = {
      members: wx.getStorageSync('members') || [],
      adminList: app.getAdminList() || [],
      activities: wx.getStorageSync('activities') || [],
      storeStatus: wx.getStorageSync('storeStatus') || {},
      backupTime: new Date().toISOString()
    };

    const dataStr = JSON.stringify(allData, null, 2);

    wx.setClipboardData({
      data: dataStr,
      success: () => {
        wx.showToast({
          title: '备份数据已复制',
          icon: 'success'
        });
      }
    });
  }
});
