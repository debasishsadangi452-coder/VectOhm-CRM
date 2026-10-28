import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { NotificationType, RoleName, TaskMessageType, TaskStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/types/request-user.type";
import { ChatService } from "../chat/chat.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SendTaskMessageDto } from "./dto/send-task-message.dto";
import { RequestTaskUpdateDto } from "./dto/request-task-update.dto";
import { SubmitTaskUpdateDto } from "./dto/submit-task-update.dto";
import { collectAssigneeIds } from "./task-deadline.util";

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  role: { select: { name: true } },
  department: { select: { id: true, name: true } },
};

@Injectable()
export class TaskCommunicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly notifications: NotificationsService,
  ) {}

  private async getTaskAndAssertAccess(taskId: string, user: RequestUser) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: userSelect },
        assignees: { include: { user: { select: userSelect } } },
        creator: { select: userSelect },
        project: { select: { id: true, name: true, departmentId: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    if (user.role.name === RoleName.ADMIN) {
      return task;
    }

    const isAssignee =
      task.assigneeId === user.id ||
      task.assignees?.some((a) => a.userId === user.id);
    const isCreator = task.creatorId === user.id;

    if (user.role.name === RoleName.MANAGER) {
      const isDeptMatch =
        !task.departmentId ||
        task.departmentId === user.department?.id ||
        task.project?.departmentId === user.department?.id;

      if (!isAssignee && !isCreator && !isDeptMatch) {
        throw new ForbiddenException("Access denied: You cannot view communication for this task");
      }
      return task;
    }

    // Employee
    if (!isAssignee && !isCreator) {
      throw new ForbiddenException("Access denied: You are not assigned to this task");
    }

    return task;
  }

  // An explicit recipient must be someone who could open this task's
  // conversation themselves -- otherwise a DM and notification carrying the
  // task's title would be delivered to an arbitrary user.
  private async assertValidRecipient(task: any, recipientId: string) {
    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, isActive: true, departmentId: true, role: { select: { name: true } } },
    });
    if (!recipient || !recipient.isActive) {
      throw new NotFoundException("Recipient not found");
    }
    const inTask =
      recipient.role.name === RoleName.ADMIN ||
      task.assigneeId === recipient.id ||
      task.creatorId === recipient.id ||
      task.testerId === recipient.id ||
      task.assignees?.some((a: any) => a.userId === recipient.id) ||
      (recipient.role.name === RoleName.MANAGER &&
        (!task.departmentId ||
          task.departmentId === recipient.departmentId ||
          task.project?.departmentId === recipient.departmentId));
    if (!inTask) {
      throw new ForbiddenException("That person is not part of this task");
    }
  }

  async getMessages(taskId: string, user: RequestUser) {
    const task = await this.getTaskAndAssertAccess(taskId, user);

    const messages = await this.prisma.taskMessage.findMany({
      where: { taskId },
      include: {
        sender: { select: userSelect },
        recipient: { select: userSelect },
      },
      orderBy: { createdAt: "asc" },
    });

    // Mark unread messages addressed to user as read
    await this.prisma.taskMessage.updateMany({
      where: {
        taskId,
        recipientId: user.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return {
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        startDate: task.startDate,
        assignee: task.assignee,
        assignees: task.assignees?.map((a) => a.user),
        creator: task.creator,
        department: task.department || (task.project?.departmentId ? { id: task.project.departmentId } : null),
        overdueNotifiedAt: task.overdueNotifiedAt,
        lastUpdateRequestAt: task.lastUpdateRequestAt,
      },
      messages,
    };
  }

  private async resolveRecipient(
    taskId: string,
    user: RequestUser,
    task: any,
    explicitRecipientId?: string,
  ): Promise<string | null> {
    if (explicitRecipientId && explicitRecipientId !== user.id) {
      return explicitRecipientId;
    }

    // 1. Check if there was a previous message in this task from ANOTHER user (e.g. manager who requested update or messaged)
    const lastOtherMessage = await this.prisma.taskMessage.findFirst({
      where: {
        taskId,
        senderId: { not: user.id },
      },
      orderBy: { createdAt: "desc" },
    });

    if (lastOtherMessage?.senderId && lastOtherMessage.senderId !== user.id) {
      return lastOtherMessage.senderId;
    }

    // 2. If current user is an assignee (or employee sending to management):
    const isAssignee =
      task.assigneeId === user.id ||
      task.assignees?.some((a: any) => (a.userId || a.user?.id) === user.id);

    if (isAssignee || user.role.name === RoleName.EMPLOYEE) {
      // Check if task creator is a different person
      if (task.creatorId && task.creatorId !== user.id) {
        return task.creatorId;
      }

      // Look for the Department Manager
      const deptId = task.departmentId || task.project?.departmentId || user.department?.id;
      if (deptId) {
        const mgr = await this.prisma.user.findFirst({
          where: {
            departmentId: deptId,
            role: { name: RoleName.MANAGER },
            isActive: true,
            id: { not: user.id },
          },
        });
        if (mgr) return mgr.id;
      }

      // Fallback to any active Admin
      const admin = await this.prisma.user.findFirst({
        where: {
          role: { name: RoleName.ADMIN },
          isActive: true,
          id: { not: user.id },
        },
      });
      if (admin) return admin.id;
    } else {
      // Current user is Manager or Admin: recipient is the assignee
      if (task.assigneeId && task.assigneeId !== user.id) {
        return task.assigneeId;
      }
      const firstAssignee = task.assignees?.find((a: any) => (a.userId || a.user?.id) !== user.id);
      if (firstAssignee) {
        return firstAssignee.userId || firstAssignee.user?.id;
      }
    }

    return null;
  }

  async sendMessage(taskId: string, dto: SendTaskMessageDto, user: RequestUser) {
    const task = await this.getTaskAndAssertAccess(taskId, user);

    if (dto.recipientId && dto.recipientId !== user.id) {
      await this.assertValidRecipient(task, dto.recipientId);
    }
    const recipientId = await this.resolveRecipient(taskId, user, task, dto.recipientId);
    const messageType = dto.messageType || TaskMessageType.GENERAL_MESSAGE;

    // Create TaskMessage record
    const taskMessage = await this.prisma.taskMessage.create({
      data: {
        taskId,
        senderId: user.id,
        recipientId: recipientId || null,
        message: dto.message,
        messageType,
      },
      include: {
        sender: { select: userSelect },
        recipient: { select: userSelect },
      },
    });

    // Post to Team Chat if recipient is present and different from sender
    let teamChatMessageId: string | null = null;
    if (recipientId && recipientId !== user.id) {
      try {
        const dmChannel = await this.chatService.getOrCreateDM(recipientId, user);
        const chatContent = `Task: ${task.title}\n${dto.message}`;
        const chatMsg = await this.chatService.sendMessage(dmChannel.id, chatContent, user);
        teamChatMessageId = chatMsg.id;

        await this.prisma.taskMessage.update({
          where: { id: taskMessage.id },
          data: { teamChatMessageId },
        });
      } catch (err) {
        console.warn("Could not cross-post task message to Team Chat:", err);
      }

      // Send deep-linked notification
      const senderRole =
        user.role.name === RoleName.ADMIN
          ? "Admin"
          : user.role.name === RoleName.MANAGER
          ? "Manager"
          : "Employee";

      await this.notifications.create({
        userId: recipientId,
        type: NotificationType.TASK_MESSAGE_RECEIVED,
        title: `${senderRole} message regarding "${task.title}"`,
        message: `${user.firstName} ${user.lastName}: "${dto.message.length > 80 ? dto.message.slice(0, 80) + "..." : dto.message}"`,
        link: `/tasks?taskId=${taskId}&modal=communication`,
      });
    }

    return taskMessage;
  }

  async requestUpdate(taskId: string, dto: RequestTaskUpdateDto, user: RequestUser) {
    const task = await this.getTaskAndAssertAccess(taskId, user);

    if (user.role.name !== RoleName.ADMIN && user.role.name !== RoleName.MANAGER) {
      throw new ForbiddenException("Only Managers and Admins can request task updates");
    }

    // Everyone the task is assigned to -- the primary assignee and any
    // additional assignees -- not just the first one.
    const recipientIds = collectAssigneeIds(task).filter((id) => id !== user.id);
    if (recipientIds.length === 0) {
      throw new NotFoundException("Task has no assigned employee to request an update from");
    }

    const note = dto.note?.trim() || "Please provide an update on your progress and current status for this task.";

    await this.prisma.task.update({
      where: { id: taskId },
      data: { lastUpdateRequestAt: new Date() },
    });

    const senderRoleName = user.role.name === RoleName.ADMIN ? "Admin" : "Manager";
    const messages = [];

    for (const employeeId of recipientIds) {
      const taskMessage = await this.prisma.taskMessage.create({
        data: {
          taskId,
          senderId: user.id,
          recipientId: employeeId,
          message: note,
          messageType: TaskMessageType.UPDATE_REQUEST,
        },
        include: {
          sender: { select: userSelect },
          recipient: { select: userSelect },
        },
      });
      messages.push(taskMessage);

      // Post to Team Chat
      try {
        const dmChannel = await this.chatService.getOrCreateDM(employeeId, user);
        const chatContent = `Task Update Requested
Task: ${task.title}
${note}`;
        const chatMsg = await this.chatService.sendMessage(dmChannel.id, chatContent, user);
        await this.prisma.taskMessage.update({
          where: { id: taskMessage.id },
          data: { teamChatMessageId: chatMsg.id },
        });
      } catch (err) {
        console.warn("Could not post update request to Team Chat:", err);
      }

      // High-priority notification to the employee
      try {
        await this.notifications.create({
          userId: employeeId,
          type: NotificationType.TASK_UPDATE_REQUESTED,
          title: "Update Requested",
          message: `Your ${senderRoleName} (${user.firstName} ${user.lastName}) is requesting an update regarding task "${task.title}".`,
          link: `/tasks?taskId=${taskId}&modal=communication`,
        });
      } catch (err) {
        console.warn("Could not notify employee of update request:", err);
      }
    }

    // First message keeps the existing single-message response shape for callers.
    return messages[0];
  }

  async submitUpdate(taskId: string, dto: SubmitTaskUpdateDto, user: RequestUser) {
    const task = await this.getTaskAndAssertAccess(taskId, user);

    // This path skips TasksService's completion rules (time log, no open bugs,
    // subtasks done), so completing a task here is limited to the people who may
    // approve completion; everyone else finishes it from the task page.
    if (
      dto.status === TaskStatus.DONE &&
      task.status !== TaskStatus.DONE &&
      user.role.name !== RoleName.ADMIN &&
      user.role.name !== RoleName.MANAGER &&
      task.testerId !== user.id
    ) {
      throw new ForbiddenException(
        "Only the tester, a Manager, or an Admin can mark a task Completed. Use Ready for Review instead.",
      );
    }

    // Apply status change to Task if provided
    if (dto.status && dto.status !== task.status) {
      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          status: dto.status,
        },
      });
    }

    // Also record into existing TaskUpdate model for backward compatibility & logs
    const statusLabels: Record<string, string> = {
      TODO: "Not Started",
      IN_PROGRESS: "In Progress",
      READY_FOR_TESTING: "Ready for Review / Testing",
      CHANGES_REQUIRED: "Changes Required",
      DONE: "Completed",
    };

    const updateSummaryParts: string[] = [];
    if (dto.status) updateSummaryParts.push(`Status: ${statusLabels[dto.status] || dto.status}`);
    if (dto.progress !== undefined) updateSummaryParts.push(`Progress: ${dto.progress}%`);
    if (dto.workCompleted) updateSummaryParts.push(`Completed: ${dto.workCompleted}`);
    if (dto.currentWork) updateSummaryParts.push(`Current: ${dto.currentWork}`);
    if (dto.blockers) updateSummaryParts.push(`Blockers: ${dto.blockers}`);
    if (dto.expectedCompletion) updateSummaryParts.push(`Expected: ${new Date(dto.expectedCompletion).toLocaleDateString()}`);
    if (dto.additionalMessage) updateSummaryParts.push(`Note: ${dto.additionalMessage}`);

    await this.prisma.taskUpdate.create({
      data: {
        taskId,
        userId: user.id,
        content: updateSummaryParts.join(" | ") || "Task progress update submitted",
      },
    }).catch((e) => console.warn("Failed to create taskUpdate log:", e));

    // Determine manager/admin recipient
    const recipientId = await this.resolveRecipient(taskId, user, task);

    // Create TaskMessage
    const taskMessage = await this.prisma.taskMessage.create({
      data: {
        taskId,
        senderId: user.id,
        recipientId: recipientId || null,
        message: dto.additionalMessage || "Task update submitted",
        messageType: TaskMessageType.TASK_UPDATE,
        status: dto.status || null,
        progress: dto.progress !== undefined ? dto.progress : null,
        workCompleted: dto.workCompleted || null,
        currentWork: dto.currentWork || null,
        blockers: dto.blockers || null,
        expectedCompletion: dto.expectedCompletion ? new Date(dto.expectedCompletion) : null,
      },
      include: {
        sender: { select: userSelect },
        recipient: { select: userSelect },
      },
    });

    // Format clean chat message content
    const chatLines = [
      `Task Update: ${task.title}`,
      dto.status ? `Status: ${statusLabels[dto.status] || dto.status}` : null,
      dto.progress !== undefined ? `Progress: ${dto.progress}%` : null,
      dto.workCompleted ? `Work Completed:\n${dto.workCompleted}` : null,
      dto.currentWork ? `Current Work:\n${dto.currentWork}` : null,
      dto.blockers ? `Blockers:\n${dto.blockers}` : null,
      dto.expectedCompletion ? `Expected Completion: ${new Date(dto.expectedCompletion).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : null,
      dto.additionalMessage ? `Message:\n${dto.additionalMessage}` : null,
    ].filter(Boolean);

    const chatContent = chatLines.join("\n");

    // Post to Team Chat if recipient is available
    if (recipientId && recipientId !== user.id) {
      try {
        const dmChannel = await this.chatService.getOrCreateDM(recipientId, user);
        const chatMsg = await this.chatService.sendMessage(dmChannel.id, chatContent, user);
        await this.prisma.taskMessage.update({
          where: { id: taskMessage.id },
          data: { teamChatMessageId: chatMsg.id },
        });
      } catch (err) {
        console.warn("Could not post structured update to Team Chat:", err);
      }
    }

    // Notify Manager and Admins
    const recipientsToNotify = new Set<string>();
    if (recipientId && recipientId !== user.id) {
      recipientsToNotify.add(recipientId);
    }
    if (task.creatorId && task.creatorId !== user.id) {
      recipientsToNotify.add(task.creatorId);
    }

    const deptId = task.departmentId || task.project?.departmentId || user.department?.id;
    if (deptId) {
      const deptManagers = await this.prisma.user.findMany({
        where: { departmentId: deptId, role: { name: RoleName.MANAGER }, isActive: true, id: { not: user.id } },
        select: { id: true },
      });
      for (const m of deptManagers) {
        recipientsToNotify.add(m.id);
      }
    }

    // Admins
    const admins = await this.prisma.user.findMany({
      where: { role: { name: RoleName.ADMIN }, isActive: true, id: { not: user.id } },
      select: { id: true },
    });
    for (const a of admins) {
      recipientsToNotify.add(a.id);
    }

    for (const targetUserId of recipientsToNotify) {
      await this.notifications.create({
        userId: targetUserId,
        type: NotificationType.TASK_UPDATE_SUBMITTED,
        title: "📋 Task Update Received",
        message: `${user.firstName} ${user.lastName} has submitted an update for "${task.title}".${dto.progress !== undefined ? ` (${dto.progress}%)` : ""}`,
        link: `/tasks?taskId=${taskId}&modal=communication`,
      });
    }

    return taskMessage;
  }
}
