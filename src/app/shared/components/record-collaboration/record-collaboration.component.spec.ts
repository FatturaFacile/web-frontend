import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollaborationApiService } from '@core/api/collaboration-api.service';
import { TranslateService } from '@core/i18n/i18n.service';
import type { CollaborationComment, CollaborationTag } from '@core/models/collaboration.model';
import { RecordCollaborationComponent } from './record-collaboration.component';

const comment: CollaborationComment = {
  id: 'cm-1',
  record_type: 'contact',
  record_id: 'rec-1',
  body: 'First',
  mentions: ['u2'],
  author: { id: 'u1', name: 'Ada' },
  can_edit: true,
  can_delete: true,
  edited_at: null,
  created_at: '2027-06-15T09:00:00+00:00',
};

const tag: CollaborationTag = { id: 'tg-1', name: 'VIP', color: '#1677ff', usage_count: 1, created_at: '2027-06-15T09:00:00+00:00' };

describe('RecordCollaborationComponent', () => {
  const api = {
    getComments: vi.fn(),
    getRecordTags: vi.fn(),
    getMentionableUsers: vi.fn(),
    getTags: vi.fn(),
    getActivity: vi.fn(),
    createComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
    attachTag: vi.fn(),
    detachTag: vi.fn(),
  };
  const message = { error: vi.fn(), success: vi.fn() };
  const translateSpy = { instant: vi.fn((key: string) => key), translate: vi.fn((key: string) => key) };

  function setup() {
    TestBed.configureTestingModule({
      imports: [RecordCollaborationComponent],
      providers: [
        { provide: CollaborationApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
        { provide: TranslateService, useValue: translateSpy },
      ],
    });
    const fixture = TestBed.createComponent(RecordCollaborationComponent);
    fixture.componentRef.setInput('recordType', 'contact');
    fixture.componentRef.setInput('recordId', 'rec-1');
    fixture.detectChanges();

    return { fixture, component: fixture.componentInstance };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.getComments.mockReturnValue(of({ data: [comment] }));
    api.getRecordTags.mockReturnValue(of({ data: [tag] }));
    api.getMentionableUsers.mockReturnValue(of({ data: [{ id: 'u2', name: 'Bob', email: 'bob@test.example' }] }));
    api.getTags.mockReturnValue(of({ data: [tag, { ...tag, id: 'tg-2', name: 'Late payer' }] }));
    api.getActivity.mockReturnValue(of({ data: [{ id: 'a1', action: 'UPDATED', module_code: 'crm', actor: null, changed_fields: ['email'], occurred_at: '2027-06-15T09:00:00+00:00' }] }));
  });

  it('loads comments, tags and mentionable users of the record', () => {
    const { component } = setup();

    expect(api.getComments).toHaveBeenCalledWith('contact', 'rec-1');
    expect(api.getRecordTags).toHaveBeenCalledWith('contact', 'rec-1');
    expect(component.comments()).toEqual([comment]);
    expect(component.tags()).toEqual([tag]);
    expect(component.mentionableUsers()).toHaveLength(1);
    expect(component.tagSuggestions().map((suggestion) => suggestion.name)).toEqual(['Late payer']);
  });

  it('posts a comment with its mentions, puts it first and clears the form', () => {
    const created = { ...comment, id: 'cm-2', body: 'Second' };
    api.createComment.mockReturnValue(of({ data: created }));
    const { component } = setup();

    component.newBody.set('  Second ');
    component.newMentions.set(['u2']);
    component.sendComment();

    expect(api.createComment).toHaveBeenCalledWith('contact', 'rec-1', { body: 'Second', mentions: ['u2'] });
    expect(component.comments().map((item) => item.id)).toEqual(['cm-2', 'cm-1']);
    expect(component.newBody()).toBe('');
    expect(component.newMentions()).toEqual([]);
  });

  it('does not send an empty comment', () => {
    const { component } = setup();

    component.newBody.set('   ');
    component.sendComment();

    expect(component.canSend()).toBe(false);
    expect(api.createComment).not.toHaveBeenCalled();
  });

  it('edits a comment in place and deletes one', () => {
    api.updateComment.mockReturnValue(of({ data: { ...comment, body: 'Edited', edited_at: '2027-06-15T10:00:00+00:00' } }));
    api.deleteComment.mockReturnValue(of(undefined));
    const { component } = setup();

    component.startEdit(comment);
    component.editBody.set('Edited');
    component.saveEdit(comment);

    expect(api.updateComment).toHaveBeenCalledWith('cm-1', { body: 'Edited', mentions: ['u2'] });
    expect(component.comments()[0].body).toBe('Edited');
    expect(component.editingId()).toBeNull();

    component.deleteComment(comment);

    expect(api.deleteComment).toHaveBeenCalledWith('cm-1');
    expect(component.comments()).toEqual([]);
  });

  it('shows the API validation message when a comment is refused', () => {
    api.createComment.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403, error: { detail: 'Not allowed' } })));
    const { component } = setup();

    component.newBody.set('Hello');
    component.sendComment();

    expect(message.error).toHaveBeenCalledWith('Not allowed');
    expect(component.comments()).toEqual([comment]);
  });

  it('attaches a tag by name, detaches it and loads the activity only when its tab opens', () => {
    api.attachTag.mockReturnValue(of({ data: [tag, { ...tag, id: 'tg-3', name: 'New' }] }));
    api.detachTag.mockReturnValue(of(undefined));
    const { component } = setup();

    expect(api.getActivity).not.toHaveBeenCalled();

    component.newTag.set(' New ');
    component.addTag();

    expect(api.attachTag).toHaveBeenCalledWith('contact', 'rec-1', { name: 'New' });
    expect(component.tags().map((item) => item.name)).toEqual(['VIP', 'New']);
    expect(component.newTag()).toBe('');

    component.removeTag(tag);

    expect(api.detachTag).toHaveBeenCalledWith('contact', 'rec-1', 'tg-1');
    expect(component.tags().map((item) => item.id)).toEqual(['tg-3']);

    component.selectTab('activity');

    expect(api.getActivity).toHaveBeenCalledWith('contact', 'rec-1');
    expect(component.activity()).toHaveLength(1);
    expect(component.activityLabel(component.activity()[0])).toBe('COLLAB.ACTIVITY_UPDATED');
  });

  it('reloads when the record changes', () => {
    const { fixture } = setup();

    fixture.componentRef.setInput('recordId', 'rec-2');
    fixture.detectChanges();

    expect(api.getComments).toHaveBeenLastCalledWith('contact', 'rec-2');
  });
});
