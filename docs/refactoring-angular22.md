# Angular 22 Clean Architecture & Refactoring Prompt for Agy

This document contains the prompt to provide to **agy** (or any AI coding agent) to refactor an Angular 22 project, along with architectural references, folder structure guidelines, and practical code examples.

## 1. Prompt for Agy

Copy and paste the block below directly into your prompt or configuration for **agy**:

```
Inspect and refactor the directory structure and codebase of this Angular 22 solution to strictly align with Clean Architecture principles, modern Angular 22 idioms, and repository conventions.

Key requirements to enforce:

1. Clean Architecture & Layered Boundaries:
   - Enforce clean separation of concerns across well-defined layers:
     - core/: Application-wide singleton services, functional interceptors, functional route guards, global state stores, and environment providers.
     - shared/: Pure UI components, directives, pipes, and utility functions that are reusable, stateless, and free of domain business logic.
     - features/: Domain-driven feature modules organized by sub-domain, housing smart/page components, feature-scoped SignalStores, feature routes, and domain-specific components.
   - Strict Dependency Inversion Rule: The domain layer must be independent of UI, presentation, and external infrastructure/API details.

2. Data Access Layer (Repository Pattern, DTOs & Domain Mappers):
   - Domain Models: Define pure domain entities/models in a dedicated domain/models/ path. Domain models must represent application state cleanly and contain business validations where needed, entirely decoupled from API schemas.
   - Data Transfer Objects (DTOs): Place raw API request/response shapes into dedicated data-access/dtos/ directories.
   - Pure Mappers: Implement deterministic, pure mapping functions/classes in data-access/mappers/ to translate bidirectional flow: DTO -> Domain Model and Domain Model -> Request DTO. Never leak raw DTO structures into UI components or SignalStores.
   - Repository Pattern:
     - Define abstract repository interfaces/tokens (*.repository.ts) declaring contracts using domain models.
     - Implement concrete repositories (*.repository.impl.ts or *.http-repository.ts) using Angular's functional HttpClient / inject(HttpClient).
     - SignalStores and application services must consume repository abstractions, not raw HTTP calls or DTOs directly.

3. Reactive State Management (NgRx SignalStore):
   - Implement state management using @ngrx/signals (signalStore):
     - Use withState for clean, immutable state definitions based on Domain Models.
     - Expose derived reactive state using withComputed and Angular Signals.
     - Encapsulate business logic, mutations, and side effects via withMethods (leveraging rxMethod alongside repository calls for asynchronous operations).
     - Maintain clear store scoping: global stores provided in root under core/state/, and feature-specific stores scoped locally or provided at the feature route/component level.

4. Unit Testing Strategy (Mappers, Repositories & SignalStores):
   - Pure Mappers (*.mapper.spec.ts):
     - Write pure, framework-free unit tests verifying 100% deterministic transformation between DTOs and Domain Models.
     - Test boundary edge cases, optional/nullable fields, default fallbacks, and date/numeric conversions.
   - Repositories (*.repository.spec.ts):
     - Test concrete implementations using HttpTestingController (via provideHttpClient() and provideHttpClientTesting()).
     - Verify correct HTTP methods, target URLs, serialization of payload DTOs, and proper mapping to domain models upon response.
     - Validate HTTP error scenarios and failure propagation.
   - SignalStores (*.store.spec.ts):
     - Test state mutations and computed signals in isolation using mock repository implementations (injecting mocked repository tokens).
     - Verify initial signal values, asynchronous method execution, pending/loading states, and error handling.
     - Ensure reactive assertions properly read signal values without unhandled asynchronous race conditions.

5. Angular 22 Idiomatic Standards (Modern & NgModule-Free):
   - Standalone Architecture: Ensure all components, directives, and pipes are standalone. Completely remove legacy NgModule declarations and imports.
   - Functional Providers & DI: Replace constructor-based DI with the inject() function. Use functional configuration providers (provideHttpClient(), provideRouter(), provideAnimationsAsync()).
   - Signal-Based Component APIs: Prefer signal-based inputs/outputs (input(), model(), output()) and signal queries (viewChild(), contentChild()).
   - Native Control Flow: Enforce the built-in control flow (@if, @for with required track, @switch, @defer) and eliminate legacy *ngIf/*ngFor directives.

6. Path Aliases (tsconfig.json):
   - Configure clean, standard path mappings under compilerOptions.paths (e.g., @core/*, @shared/*, @features/*, @domain/*, @data-access/*, @env/*).
   - Eliminate all relative deep navigation (e.g., replace ../../../../core/... with explicit path aliases across both source and test files).

7. Barrel Exports (index.ts):
   - Maintain index.ts public APIs at layer, domain, and feature boundaries.
   - Restrict cross-layer references strictly through these barrel exports to maintain encapsulation.
   - Guard against circular dependencies caused by barrel re-exports.

8. File References & Markdown Documentation:
   - Update all import statements, template paths, assets, and project configurations across the solution.
   - Review and rewrite all *.md files (README, architecture docs, folder diagrams) to accurately document the refactored directory hierarchy, layer responsibilities, Angular 22 idioms, SignalStore architecture, Repository/DTO patterns, and path aliases.

9. Validation:
   - Verify that Angular build (ng build), linting (ng lint), and unit tests (ng test) pass cleanly with zero unresolved imports, broken paths, or deprecation warnings.
```

## 2. Target Directory Structure Blueprint

```
src/
├── app/
│   ├── app.config.ts              # Functional providers (provideRouter, provideHttpClient, etc.)
│   ├── app.routes.ts              # Root routing table with lazy loading
│   ├── app.component.ts           # Root shell component
│   │
│   ├── core/                      # Global singletons, interceptors, guards
│   │   ├── auth/                  # Functional guards, token interceptors
│   │   ├── config/                # App-wide configurations, injection tokens
│   │   ├── state/                 # App-wide global SignalStores
│   │   └── index.ts               # Core public API barrel
│   │
│   ├── domain/                    # Pure Domain Layer (Business models & rules)
│   │   ├── models/                # Business entities (e.g., order.model.ts)
│   │   ├── repositories/          # Abstract repository interfaces / tokens
│   │   └── index.ts               # Domain public API barrel
│   │
│   ├── data-access/               # Infrastructure / API layer
│   │   ├── dtos/                  # Wire format interfaces (e.g., order.dto.ts)
│   │   ├── mappers/               # Pure functions (order.mapper.ts, order.mapper.spec.ts)
│   │   ├── repositories/          # Concrete implementations (order-http.repository.ts)
│   │   └── index.ts               # Data access public API barrel
│   │
│   ├── shared/                    # Dumb/reusable UI components & utilities
│   │   ├── ui/                    # Pure presentational components (buttons, modals)
│   │   ├── directives/            # Utility directives
│   │   ├── pipes/                 # Pure pipes
│   │   ├── utils/                 # Pure helper functions
│   │   └── index.ts               # Shared public API barrel
│   │
│   └── features/                  # Business Feature Domains
│       ├── order-history/
│       │   ├── components/        # Feature-specific components
│       │   ├── state/             # Feature-scoped SignalStore (order.store.ts, order.store.spec.ts)
│       │   ├── order.routes.ts    # Lazy feature routes
│       │   └── index.ts
│       └── ...
│
├── environments/
│   ├── environment.ts
│   └── environment.development.ts
├── tsconfig.json
└── angular.json
```

## 3. Recommended `tsconfig.json` Paths Setup

```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@core": ["src/app/core/index.ts"],
      "@core/*": ["src/app/core/*"],
      "@domain": ["src/app/domain/index.ts"],
      "@domain/*": ["src/app/domain/*"],
      "@data-access": ["src/app/data-access/index.ts"],
      "@data-access/*": ["src/app/data-access/*"],
      "@shared": ["src/app/shared/index.ts"],
      "@shared/*": ["src/app/shared/*"],
      "@features/*": ["src/app/features/*"],
      "@env": ["src/environments/environment.ts"]
    }
  }
}
```

## 4. Architectural Reference Implementations (Angular 22)

### A. Domain Model & Repository Contract (Domain Layer)

`src/app/domain/models/order.model.ts`:

```typescript
export interface OrderItem {
  readonly id: string;
  readonly productName: string;
  readonly quantity: number;
  readonly unitPrice: number;
}

export interface Order {
  readonly id: string;
  readonly referenceNumber: string;
  readonly createdAt: Date;
  readonly items: readonly OrderItem[];
  readonly totalAmount: number;
}
```

`src/app/domain/repositories/order.repository.ts`:

```typescript
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Order } from '../models/order.model';

export interface OrderRepository {
  getOrders(): Observable<Order[]>;
  getOrderById(id: string): Observable<Order>;
}

export const ORDER_REPOSITORY = new InjectionToken<OrderRepository>('ORDER_REPOSITORY');
```

### B. DTO & Pure Bidirectional Mapper (Data-Access Layer)

`src/app/data-access/dtos/order.dto.ts`:

```typescript
export interface OrderItemDto {
  item_id: string;
  prod_name: string;
  qty: number;
  price: number;
}

export interface OrderDto {
  order_id: string;
  ref_code: string;
  created_timestamp: string; // ISO String from backend
  items: OrderItemDto[];
  total: number;
}
```

`src/app/data-access/mappers/order.mapper.ts`:

```typescript
import { Order, OrderItem } from '@domain/models/order.model';
import { OrderDto, OrderItemDto } from '../dtos/order.dto';

export class OrderMapper {
  static toDomain(dto: OrderDto): Order {
    return {
      id: dto.order_id,
      referenceNumber: dto.ref_code,
      createdAt: new Date(dto.created_timestamp),
      items: dto.items.map(this.mapItemToDomain),
      totalAmount: dto.total,
    };
  }

  static toDto(model: Order): OrderDto {
    return {
      order_id: model.id,
      ref_code: model.referenceNumber,
      created_timestamp: model.createdAt.toISOString(),
      items: model.items.map(this.mapItemToDto),
      total: model.totalAmount,
    };
  }

  private static mapItemToDomain(itemDto: OrderItemDto): OrderItem {
    return {
      id: itemDto.item_id,
      productName: itemDto.prod_name,
      quantity: itemDto.qty,
      unitPrice: itemDto.price,
    };
  }

  private static mapItemToDto(item: OrderItem): OrderItemDto {
    return {
      item_id: item.id,
      prod_name: item.productName,
      qty: item.quantity,
      price: item.unitPrice,
    };
  }
}
```

### C. Concrete HTTP Repository (Data-Access Layer)

`src/app/data-access/repositories/order-http.repository.ts`:

```typescript
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { Order } from '@domain/models/order.model';
import { OrderRepository } from '@domain/repositories/order.repository';
import { OrderDto } from '../dtos/order.dto';
import { OrderMapper } from '../mappers/order.mapper';

@Injectable()
export class OrderHttpRepository implements OrderRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/orders';

  getOrders(): Observable<Order[]> {
    return this.http
      .get<OrderDto[]>(this.baseUrl)
      .pipe(map((dtos) => dtos.map(OrderMapper.toDomain)));
  }

  getOrderById(id: string): Observable<Order> {
    return this.http
      .get<OrderDto>(`${this.baseUrl}/${id}`)
      .pipe(map(OrderMapper.toDomain));
  }
}
```

### D. NgRx SignalStore (Feature State Layer)

`src/app/features/order-history/state/order.store.ts`:

```typescript
import { computed, inject } from '@angular/core';
import { pipe, switchMap, tap } from 'rxjs';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { Order } from '@domain/models/order.model';
import { ORDER_REPOSITORY } from '@domain/repositories/order.repository';

interface OrderState {
  orders: Order[];
  selectedOrderId: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: OrderState = {
  orders: [],
  selectedOrderId: null,
  isLoading: false,
  error: null,
};

export const OrderStore = signalStore(
  withState(initialState),
  withComputed(({ orders, selectedOrderId }) => ({
    ordersCount: computed(() => orders().length),
    selectedOrder: computed(() => orders().find((o) => o.id === selectedOrderId()) ?? null),
    totalRevenue: computed(() => orders().reduce((sum, order) => sum + order.totalAmount, 0)),
  })),
  withMethods((store, repository = inject(ORDER_REPOSITORY)) => ({
    setSelectedOrderId(selectedOrderId: string | null): void {
      patchState(store, { selectedOrderId });
    },
    loadOrders: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap(() =>
          repository.getOrders().pipe(
            tap({
              next: (orders) => patchState(store, { orders, isLoading: false }),
              error: (err: Error) => patchState(store, { error: err.message, isLoading: false }),
            })
          )
        )
      )
    ),
  }))
);
```

### E. Isolated Unit Test for SignalStore with Mock Repository

`src/app/features/order-history/state/order.store.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Order } from '@domain/models/order.model';
import { ORDER_REPOSITORY, OrderRepository } from '@domain/repositories/order.repository';
import { OrderStore } from './order.store';

describe('OrderStore', () => {
  let store: InstanceType<typeof OrderStore>;
  let mockRepository: jasmine.SpyObj<OrderRepository>;

  const mockOrders: Order[] = [
    {
      id: 'ord-1',
      referenceNumber: 'REF-001',
      createdAt: new Date('2026-01-01T10:00:00Z'),
      items: [{ id: 'item-1', productName: 'Widget A', quantity: 2, unitPrice: 50 }],
      totalAmount: 100,
    },
    {
      id: 'ord-2',
      referenceNumber: 'REF-002',
      createdAt: new Date('2026-01-02T12:00:00Z'),
      items: [{ id: 'item-2', productName: 'Widget B', quantity: 1, unitPrice: 150 }],
      totalAmount: 150,
    },
  ];

  beforeEach(() => {
    mockRepository = jasmine.createSpyObj<OrderRepository>('OrderRepository', [
      'getOrders',
      'getOrderById',
    ]);

    TestBed.configureTestingModule({
      providers: [
        OrderStore,
        { provide: ORDER_REPOSITORY, useValue: mockRepository },
      ],
    });

    store = TestBed.inject(OrderStore);
  });

  it('should initialize with default state and computed signals', () => {
    expect(store.orders()).toEqual([]);
    expect(store.ordersCount()).toBe(0);
    expect(store.selectedOrderId()).toBeNull();
    expect(store.selectedOrder()).toBeNull();
    expect(store.totalRevenue()).toBe(0);
    expect(store.isLoading()).toBeFalse();
    expect(store.error()).toBeNull();
  });

  it('should update selectedOrderId and resolve selectedOrder computed signal', () => {
    mockRepository.getOrders.and.returnValue(of(mockOrders));
    store.loadOrders();

    store.setSelectedOrderId('ord-2');

    expect(store.selectedOrderId()).toBe('ord-2');
    expect(store.selectedOrder()).toEqual(mockOrders[1]);
  });

  it('should load orders successfully and calculate total revenue', () => {
    mockRepository.getOrders.and.returnValue(of(mockOrders));

    store.loadOrders();

    expect(mockRepository.getOrders).toHaveBeenCalledTimes(1);
    expect(store.isLoading()).toBeFalse();
    expect(store.orders()).toEqual(mockOrders);
    expect(store.ordersCount()).toBe(2);
    expect(store.totalRevenue()).toBe(250);
    expect(store.error()).toBeNull();
  });

  it('should handle repository errors gracefully', () => {
    const errorMessage = 'Network error fetching orders';
    mockRepository.getOrders.and.returnValue(throwError(() => new Error(errorMessage)));

    store.loadOrders();

    expect(mockRepository.getOrders).toHaveBeenCalledTimes(1);
    expect(store.isLoading()).toBeFalse();
    expect(store.orders()).toEqual([]);
    expect(store.error()).toBe(errorMessage);
  });
});
```

### F. Provider Registration in Feature Route / App Config

`src/app/features/order-history/order.routes.ts`:

```typescript
import { Routes } from '@angular/router';
import { ORDER_REPOSITORY } from '@domain/repositories/order.repository';
import { OrderHttpRepository } from '@data-access/repositories/order-http.repository';
import { OrderStore } from './state/order.store';

export const ORDER_ROUTES: Routes = [
  {
    path: '',
    providers: [
      { provide: ORDER_REPOSITORY, useClass: OrderHttpRepository },
      OrderStore,
    ],
    loadComponent: () =>
      import('./components/order-list/order-list.component').then(
        (m) => m.OrderListComponent
      ),
  },
];
```