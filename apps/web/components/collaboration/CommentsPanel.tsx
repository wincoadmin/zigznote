'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Send,
  Reply,
  MoreHorizontal,
  Trash2,
  Edit2,
  Check,
  X,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Smile,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { commentsApi, type Comment } from '@/lib/api';

interface CommentsPanelProps {
  meetingId: string;
  segmentId?: string;
  className?: string;
}

const REACTION_EMOJIS = ['👍', '❤️', '🎉', '👀', '🤔', '😊'];

function UserAvatar({ name, avatarUrl }: { name: string | null; avatarUrl: string | null }) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'User'}
        className="w-8 h-8 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-xs font-medium text-emerald-700 dark:text-emerald-300">
      {initials}
    </div>
  );
}

function CommentItem({
  comment,
  meetingId,
  onReply,
  depth = 0,
}: {
  comment: Comment;
  meetingId: string;
  onReply: (parentId: string) => void;
  depth?: number;
}) {
  const [showReplies, setShowReplies] = useState(depth < 1);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const queryClient = useQueryClient();

  // Fetch replies
  const { data: repliesData } = useQuery({
    queryKey: ['comment-replies', comment.id],
    queryFn: async () => {
      const response = await commentsApi.getReplies(comment.id);
      return response.success ? response.data || [] : [];
    },
    enabled: showReplies && comment.replyCount > 0,
  });

  const replies = repliesData || [];

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (content: string) => commentsApi.update(comment.id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', meetingId] });
      setIsEditing(false);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => commentsApi.delete(comment.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', meetingId] });
    },
  });

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: () =>
      comment.isResolved
        ? commentsApi.unresolve(comment.id)
        : commentsApi.resolve(comment.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', meetingId] });
    },
  });

  // Reaction mutation
  const reactionMutation = useMutation({
    mutationFn: ({ emoji, hasReacted }: { emoji: string; hasReacted: boolean }) =>
      hasReacted
        ? commentsApi.removeReaction(comment.id, emoji)
        : commentsApi.addReaction(comment.id, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', meetingId] });
    },
  });

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== comment.content) {
      updateMutation.mutate(editContent.trim());
    } else {
      setIsEditing(false);
    }
  };

  const userName =
    comment.user.name ||
    `${comment.user.firstName || ''} ${comment.user.lastName || ''}`.trim() ||
    comment.user.email;

  return (
    <div className={cn('group', depth > 0 && 'ml-8 border-l-2 border-slate-200 dark:border-slate-700 pl-4')}>
      <div
        className={cn(
          'p-3 rounded-lg transition-colors',
          comment.isResolved
            ? 'bg-slate-50 dark:bg-slate-800/30 opacity-60'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <UserAvatar name={userName} avatarUrl={comment.user.avatarUrl} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-slate-900 dark:text-slate-100">
                {userName}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
              </span>
              {comment.isEdited && (
                <span className="text-xs text-slate-400 dark:text-slate-500">(edited)</span>
              )}
              {comment.isResolved && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-3 h-3" />
                  Resolved
                </span>
              )}
            </div>

            {/* Content */}
            {isEditing ? (
              <div className="mt-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full p-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  rows={3}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={updateMutation.isPending}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditContent(comment.content);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <X className="w-3 h-3" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {comment.content}
              </p>
            )}

            {/* Reactions */}
            {comment.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {comment.reactions.map((reaction) => (
                  <button
                    key={reaction.emoji}
                    onClick={() =>
                      reactionMutation.mutate({
                        emoji: reaction.emoji,
                        hasReacted: reaction.hasReacted,
                      })
                    }
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full transition-colors',
                      reaction.hasReacted
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    )}
                  >
                    <span>{reaction.emoji}</span>
                    <span>{reaction.count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Reaction picker */}
              <div className="relative">
                <button
                  onClick={() => setShowReactions(!showReactions)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
                >
                  <Smile className="w-4 h-4" />
                </button>
                {showReactions && (
                  <div className="absolute bottom-full left-0 mb-1 p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 flex gap-1 z-10">
                    {REACTION_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          const existing = comment.reactions.find((r) => r.emoji === emoji);
                          reactionMutation.mutate({
                            emoji,
                            hasReacted: existing?.hasReacted || false,
                          });
                          setShowReactions(false);
                        }}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => onReply(comment.id)}
                className="inline-flex items-center gap-1 p-1 text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                <Reply className="w-4 h-4" />
                Reply
              </button>

              {!comment.parentId && (
                <button
                  onClick={() => resolveMutation.mutate()}
                  disabled={resolveMutation.isPending}
                  className="inline-flex items-center gap-1 p-1 text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                >
                  <CheckCircle className="w-4 h-4" />
                  {comment.isResolved ? 'Unresolve' : 'Resolve'}
                </button>
              )}

              <div className="relative">
                <button
                  onClick={() => setShowActions(!showActions)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {showActions && (
                  <div className="absolute right-0 top-full mt-1 py-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 min-w-[120px] z-10">
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setShowActions(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this comment?')) {
                          deleteMutation.mutate();
                        }
                        setShowActions(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Replies toggle */}
      {comment.replyCount > 0 && (
        <button
          onClick={() => setShowReplies(!showReplies)}
          className="ml-11 mt-1 inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          {showReplies ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
          {comment.replyCount} {comment.replyCount === 1 ? 'reply' : 'replies'}
        </button>
      )}

      {/* Replies */}
      {showReplies && replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              meetingId={meetingId}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentsPanel({ meetingId, segmentId, className }: CommentsPanelProps) {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  // Fetch comments
  const { data: commentsData, isLoading } = useQuery({
    queryKey: ['comments', meetingId, segmentId],
    queryFn: async () => {
      const response = await commentsApi.getComments(meetingId, { segmentId });
      return response.success ? response.data || [] : [];
    },
  });

  const comments = commentsData || [];

  // Create comment mutation
  const createMutation = useMutation({
    mutationFn: (data: { content: string; parentId?: string; segmentId?: string }) =>
      commentsApi.create(meetingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', meetingId] });
      setNewComment('');
      setReplyingTo(null);
    },
  });

  const handleSubmit = () => {
    if (!newComment.trim() || createMutation.isPending) return;

    createMutation.mutate({
      content: newComment.trim(),
      parentId: replyingTo || undefined,
      segmentId,
    });
  };

  const handleReply = (parentId: string) => {
    setReplyingTo(parentId);
    inputRef.current?.focus();
  };

  const replyingToComment = replyingTo
    ? comments.find((c) => c.id === replyingTo)
    : null;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <MessageSquare className="w-5 h-5 text-emerald-600" />
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">Comments</h3>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          ({comments.length})
        </span>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No comments yet</p>
            <p className="text-xs mt-1">Be the first to add a comment</p>
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              meetingId={meetingId}
              onReply={handleReply}
            />
          ))
        )}
      </div>

      {/* New comment input */}
      <div className="border-t border-slate-200 dark:border-slate-800 p-4">
        {replyingTo && replyingToComment && (
          <div className="flex items-center gap-2 mb-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded px-2 py-1">
            <Reply className="w-3 h-3" />
            <span>
              Replying to{' '}
              <strong>
                {replyingToComment.user.name || replyingToComment.user.email}
              </strong>
            </span>
            <button
              onClick={() => setReplyingTo(null)}
              className="ml-auto p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 p-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || createMutation.isPending}
            className="self-end p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Press Cmd+Enter to send
        </p>
      </div>
    </div>
  );
}

export default CommentsPanel;
