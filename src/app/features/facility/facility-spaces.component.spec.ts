import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { AuthStore, FacilityApiService, FacilityBuilding, FacilitySpace, FacilitySpaceNode, TranslateService } from '@core';
import { FacilitySpacesComponent } from './facility-spaces.component';

describe('FacilitySpacesComponent', () => {
  const building: FacilityBuilding = { id: 'b-1', code: 'HQ', name: 'Sede centrale', city: 'Milano', country: 'IT', notes: null, is_active: true };
  const space = (overrides: Partial<FacilitySpace>): FacilitySpace => ({
    id: 'sp-1',
    building_id: 'b-1',
    parent_id: null,
    kind: 'floor',
    code: 'P1',
    name: 'Primo piano',
    floor_level: 1,
    capacity: null,
    area_sqm: null,
    is_bookable: false,
    is_active: true,
    amenities: [],
    notes: null,
    ...overrides,
  });
  const node = (id: string, code: string, kind: FacilitySpaceNode['kind'], children: FacilitySpaceNode[] = []): FacilitySpaceNode => ({
    id,
    building_id: 'b-1',
    parent_id: null,
    kind,
    code,
    name: code,
    capacity: null,
    is_bookable: kind === 'desk',
    is_active: true,
    children,
  });

  const api = {
    getBuildings: vi.fn(),
    getSpaceTree: vi.fn(),
    getSpaces: vi.fn(),
    createBuilding: vi.fn(),
    updateBuilding: vi.fn(),
    deleteBuilding: vi.fn(),
    createSpace: vi.fn(),
    updateSpace: vi.fn(),
    deleteSpace: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const translate = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };
  const auth = { user: () => ({ id: 'usr-1' }), activeRoles: () => ['facility_manager'], userPermissions: () => [] as string[] };

  function create(): FacilitySpacesComponent {
    const fixture = TestBed.createComponent(FacilitySpacesComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.getBuildings.mockReturnValue(of({ data: [building] }));
    api.getSpaceTree.mockReturnValue(of({ data: [node('sp-1', 'P1', 'floor', [node('sp-2', 'U1', 'office', [node('sp-3', 'D1', 'desk')])])] }));
    api.getSpaces.mockReturnValue(of({ data: [space({}), space({ id: 'sp-2', kind: 'office', code: 'U1', parent_id: 'sp-1', capacity: 12 }), space({ id: 'sp-3', kind: 'desk', code: 'D1', parent_id: 'sp-2', capacity: 1, is_bookable: true })] }));
    api.createSpace.mockReturnValue(of({ data: space({}) }));
    api.createBuilding.mockReturnValue(of({ data: building }));
    api.deleteSpace.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      imports: [FacilitySpacesComponent],
      providers: [
        { provide: FacilityApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
        { provide: TranslateService, useValue: translate },
        { provide: AuthStore, useValue: auth },
        provideNzIcons(icons),
      ],
    });
  });

  it('selects the first building and shows its nested tree', () => {
    const component = create();

    expect(api.getSpaceTree).toHaveBeenCalledWith('b-1');
    expect(component.building()?.code).toBe('HQ');
    expect(component.tree()).toHaveLength(1);
    expect(component.tree()[0].children[0].children[0].code).toBe('D1');
    expect(component.iconOf('desk')).toContain('fa-desktop');
    expect(component.abilities().manage).toBe(true);
  });

  it('offers only containers as the parent of a space', () => {
    const component = create();

    component.openSpaceModal();

    expect(component.parentCandidates().map((candidate) => candidate.code)).toEqual(['P1', 'U1']);
  });

  it('saves a desk under an office with its amenities as a list and the building of the tree', () => {
    const component = create();
    component.openSpaceModal();
    component.spaceForm.patchValue({ kind: 'desk', parent_id: 'sp-2', code: 'D2', name: 'Scrivania 2', capacity: 1, is_bookable: true, amenities: 'monitor, dock, ' });

    component.saveSpace();

    expect(api.createSpace).toHaveBeenCalledWith(
      expect.objectContaining({ building_id: 'b-1', parent_id: 'sp-2', kind: 'desk', code: 'D2', capacity: 1, is_bookable: true, amenities: ['monitor', 'dock'] }),
    );
    expect(message.success).toHaveBeenCalledWith('FACILITY.SPACE_SAVED');
    expect(component.spaceModalVisible()).toBe(false);
  });

  it('never sends a parent for a floor', () => {
    const component = create();
    component.openSpaceModal();
    component.spaceForm.patchValue({ kind: 'floor', parent_id: 'sp-2', code: 'P2', name: 'Secondo piano' });

    component.saveSpace();

    expect(api.createSpace).toHaveBeenCalledWith(expect.objectContaining({ kind: 'floor', parent_id: null }));
  });

  it('creates a building and deletes a space', () => {
    const component = create();
    component.openBuildingModal();
    component.buildingForm.patchValue({ code: 'LU', name: 'Filiale Lugano', country: 'CH' });
    component.saveBuilding();

    expect(api.createBuilding).toHaveBeenCalledWith({ code: 'LU', name: 'Filiale Lugano', city: null, country: 'CH', is_active: true });

    component.removeSpace(space({ id: 'sp-3' }));
    expect(api.deleteSpace).toHaveBeenCalledWith('sp-3');
  });
});
