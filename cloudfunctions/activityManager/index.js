// 云函数：活动管理
// cloudfunctions/activityManager/index.js

const cloud = require('wx-server-sdk');
const { getDatabaseManager } = require('../../utils/database');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const { action, data } = event;
  const dbManager = getDatabaseManager();

  try {
    // 确保数据库连接
    if (!dbManager.isHealthy()) {
      await dbManager.init();
    }

    switch (action) {
    case 'getActivities':
      return await getActivities(data, dbManager);
    case 'getActivityDetail':
      return await getActivityDetail(data, dbManager);
    case 'createActivity':
      return await createActivity(data, dbManager);
    case 'updateActivity':
      return await updateActivity(data, dbManager);
    case 'deleteActivity':
      return await deleteActivity(data, dbManager);
    case 'joinActivity':
      return await joinActivity(data, dbManager);
    case 'leaveActivity':
      return await leaveActivity(data, dbManager);
    case 'getParticipants':
      return await getParticipants(data, dbManager);
    default:
      throw new Error('未知操作');
    }
  } catch (error) {
    console.error('活动管理云函数错误:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 获取活动列表
async function getActivities(data, dbManager) {
  const { filters = {}, limit } = data;

  const activities = await dbManager.getActivities({
    ...filters,
    limit
  });

  // 获取每个活动的参与者数量
  const activitiesWithStats = await Promise.all(
    activities.map(async (activity) => {
      const participants = await dbManager.getActivityParticipants(activity.id);
      return {
        ...activity,
        currentPlayers: participants.length,
        participantList: participants
      };
    })
  );

  return {
    success: true,
    data: activitiesWithStats.map(activity => ({
      id: activity.id,
      title: activity.title,
      description: activity.description,
      date: activity.date,
      time: activity.time,
      location: activity.location,
      maxPlayers: activity.max_players,
      currentPlayers: activity.current_players,
      minPlayers: activity.min_players,
      price: parseFloat(activity.price),
      status: activity.status,
      createdBy: activity.created_by,
      createdAt: activity.created_at,
      participants: activity.participantList.map(p => ({
        phone: p.phone,
        name: p.name,
        avatarUrl: p.avatar_url,
        joinTime: p.join_time
      }))
    }))
  };
}

// 获取活动详情
async function getActivityDetail(data, dbManager) {
  const { activityId } = data;

  if (!activityId) {
    throw new Error('活动ID不能为空');
  }

  const activity = await dbManager.getActivity(activityId);
  if (!activity) {
    throw new Error('活动不存在');
  }

  const participants = await dbManager.getActivityParticipants(activityId);

  return {
    success: true,
    data: {
      id: activity.id,
      title: activity.title,
      description: activity.description,
      date: activity.date,
      time: activity.time,
      location: activity.location,
      maxPlayers: activity.max_players,
      currentPlayers: participants.length,
      minPlayers: activity.min_players,
      price: parseFloat(activity.price),
      status: activity.status,
      createdBy: activity.created_by,
      createdAt: activity.created_at,
      participants: participants.map(p => ({
        phone: p.phone,
        name: p.name,
        avatarUrl: p.avatar_url,
        joinTime: p.join_time,
        paymentStatus: p.payment_status
      }))
    }
  };
}

// 创建活动
async function createActivity(data, dbManager) {
  const { activityData } = data;

  // 验证必填字段
  if (!activityData.title || !activityData.date || !activityData.time) {
    throw new Error('活动标题、日期和时间为必填项');
  }

  const activityId = await dbManager.insert('activities', {
    title: activityData.title,
    description: activityData.description || '',
    date: activityData.date,
    time: activityData.time,
    location: activityData.location || '',
    max_players: activityData.maxPlayers || 8,
    current_players: 0,
    min_players: activityData.minPlayers || 6,
    price: activityData.price || 0.00,
    status: 'planning',
    created_by: activityData.createdBy
  });

  return {
    success: true,
    data: {
      message: '活动创建成功',
      activityId
    }
  };
}

// 更新活动
async function updateActivity(data, dbManager) {
  const { activityId, updates } = data;

  if (!activityId) {
    throw new Error('活动ID不能为空');
  }

  const updateData = {};
  if (updates.title) updateData.title = updates.title;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.date) updateData.date = updates.date;
  if (updates.time) updateData.time = updates.time;
  if (updates.location !== undefined) updateData.location = updates.location;
  if (updates.maxPlayers) updateData.max_players = updates.maxPlayers;
  if (updates.minPlayers) updateData.min_players = updates.minPlayers;
  if (updates.price !== undefined) updateData.price = updates.price;
  if (updates.status) updateData.status = updates.status;

  await dbManager.update('activities', updateData, 'id = ?', [activityId]);

  return {
    success: true,
    data: {
      message: '活动更新成功'
    }
  };
}

// 删除活动
async function deleteActivity(data, dbManager) {
  const { activityId } = data;

  if (!activityId) {
    throw new Error('活动ID不能为空');
  }

  // 检查活动是否存在
  const activity = await dbManager.getActivity(activityId);
  if (!activity) {
    throw new Error('活动不存在');
  }

  // 删除活动（级联删除参与者记录）
  await dbManager.delete('activities', 'id = ?', [activityId]);

  return {
    success: true,
    data: {
      message: '活动删除成功'
    }
  };
}

// 报名参加活动
async function joinActivity(data, dbManager) {
  const { activityId, userPhone } = data;

  if (!activityId || !userPhone) {
    throw new Error('活动ID和用户手机号不能为空');
  }

  // 检查活动是否存在
  const activity = await dbManager.getActivity(activityId);
  if (!activity) {
    throw new Error('活动不存在');
  }

  // 检查活动状态
  if (activity.status !== 'open' && activity.status !== 'planning') {
    throw new Error('活动当前无法报名');
  }

  // 检查人数是否已满
  const participants = await dbManager.getActivityParticipants(activityId);
  if (participants.length >= activity.max_players) {
    throw new Error('活动人数已满');
  }

  // 检查用户是否已经报名
  const isAlreadyJoined = participants.some(p => p.phone === userPhone);
  if (isAlreadyJoined) {
    throw new Error('已经报名参加此活动');
  }

  // 报名参加活动
  await dbManager.joinActivity(activityId, userPhone);

  // 如果人数达到最少要求，自动更新活动状态为开放
  if (participants.length + 1 >= activity.min_players && activity.status === 'planning') {
    await dbManager.update('activities', { status: 'open' }, 'id = ?', [activityId]);
  }

  return {
    success: true,
    data: {
      message: '报名成功'
    }
  };
}

// 退出活动
async function leaveActivity(data, dbManager) {
  const { activityId, userPhone } = data;

  if (!activityId || !userPhone) {
    throw new Error('活动ID和用户手机号不能为空');
  }

  // 检查是否已报名
  const participants = await dbManager.getActivityParticipants(activityId);
  const isJoined = participants.some(p => p.phone === userPhone);

  if (!isJoined) {
    throw new Error('未报名参加此活动');
  }

  // 删除报名记录
  await dbManager.delete('activity_participants', 'activity_id = ? AND user_phone = ?', [activityId, userPhone]);

  // 更新活动当前人数
  await dbManager.execute(
    'UPDATE activities SET current_players = current_players - 1 WHERE id = ?',
    [activityId]
  );

  return {
    success: true,
    data: {
      message: '已退出活动'
    }
  };
}

// 获取活动参与者
async function getParticipants(data, dbManager) {
  const { activityId } = data;

  if (!activityId) {
    throw new Error('活动ID不能为空');
  }

  const participants = await dbManager.getActivityParticipants(activityId);

  return {
    success: true,
    data: participants.map(p => ({
      phone: p.phone,
      name: p.name,
      avatarUrl: p.avatar_url,
      joinTime: p.join_time,
      paymentStatus: p.payment_status
    }))
  };
}
