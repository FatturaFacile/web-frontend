import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  chainFactors,
  cleanPayload,
  emptyLevel,
  emptyProduct,
  errorKey,
  failureOf,
  fromScaled,
  isGtinValid,
  isTaricValid,
  isTaresValid,
  kitProblems,
  matrixCombinations,
  matrixCount,
  matrixKey,
  matrixTooLarge,
  PC_MAX_COMBINATIONS,
  packagingToPayload,
  stockRules,
  toggleAxisValue,
  toScaled,
  trimDecimal,
  unitLabel,
  valueLabel,
  attributeName,
} from './product-catalog.util';
import { colorAttribute, sizeAttribute } from './product-catalog.testing';

describe('product catalog util', () => {
  describe('errors', () => {
    it('builds the translation key of an API code, generic when there is none', () => {
      expect(errorKey('kit_cycle')).toBe('productCatalog.error.kit_cycle');
      expect(errorKey(null)).toBe('productCatalog.error.generic');
    });

    it('takes the code, params and field errors of a problem', () => {
      const failure = failureOf(
        new HttpErrorResponse({
          status: 422,
          error: {
            code: 'sku_taken',
            detail: 'The SKU ABC is already in use.',
            params: { sku: 'ABC', nested: { no: 1 } },
            errors: { sku: ['taken'] },
          },
        }),
      );

      expect(failure.ok).toBe(false);
      expect(failure.errorKey).toBe('productCatalog.error.sku_taken');
      expect(failure.params).toEqual({ sku: 'ABC' });
      expect(failure.detail).toBe('taken');
      expect(failure.errors['sku']).toEqual(['taken']);
    });

    it('answers a generic failure for an error that is not a problem', () => {
      expect(failureOf(new Error('boom')).errorKey).toBe('productCatalog.error.generic');
      expect(failureOf(null).code).toBeNull();
    });
  });

  describe('exact decimals', () => {
    it('scales a decimal string to an integer and back without floating point', () => {
      expect(toScaled('0.1')).toBe(100000n);
      expect(toScaled('12.345678')).toBe(12345678n);
      expect(toScaled('-3')).toBe(-3000000n);
      expect(toScaled('abc')).toBeNull();
      expect(toScaled('')).toBeNull();
      expect(toScaled(null)).toBeNull();
      expect(fromScaled(12345678n)).toBe('12.345678');
      expect(fromScaled(-3000000n, 2)).toBe('-3.00');
      expect(fromScaled(500000n, 0)).toBe('0');
    });

    it('trims trailing zeros', () => {
      expect(trimDecimal('12.500000')).toBe('12.5');
      expect(trimDecimal('10.000000')).toBe('10');
      expect(trimDecimal('100')).toBe('100');
      expect(trimDecimal('0.000000')).toBe('0');
    });
  });

  describe('variant matrix', () => {
    it('counts the cartesian product and lists the combinations in axis order', () => {
      const axes = [
        { attribute_id: 'size', value_ids: ['s', 'm', 'l', 'xl', 'xxl'] },
        { attribute_id: 'color', value_ids: ['black', 'white', 'navy'] },
      ];

      expect(matrixCount(axes)).toBe(15);
      expect(matrixCombinations(axes)).toHaveLength(15);
      expect(matrixCombinations(axes)[0]).toEqual(['s', 'black']);
      expect(matrixCombinations(axes)[14]).toEqual(['xxl', 'navy']);
      expect(matrixKey(['a', 'b'])).toBe('a|b');
    });

    it('has no combination without an axis or with an empty axis', () => {
      expect(matrixCount([])).toBe(0);
      expect(matrixCombinations([])).toEqual([]);
      expect(matrixCombinations([{ attribute_id: 'size', value_ids: [] }])).toEqual([]);
    });

    it('flags a matrix beyond the limit of the API', () => {
      const many = Array.from({ length: 24 }, (_, index) => `v${index}`);
      const axes = ['a', 'b', 'c'].map((id) => ({ attribute_id: id, value_ids: many }));

      expect(matrixTooLarge(axes)).toBe(true);
      expect(matrixCount(axes)).toBeGreaterThan(PC_MAX_COMBINATIONS);
      expect(matrixTooLarge([{ attribute_id: 'a', value_ids: ['x'] }])).toBe(false);
    });

    it('toggles a value in the axis of an attribute and drops an axis left empty', () => {
      let axes = toggleAxisValue([], 'size', 's');
      axes = toggleAxisValue(axes, 'size', 'm');
      axes = toggleAxisValue(axes, 'color', 'black');

      expect(axes).toEqual([
        { attribute_id: 'size', value_ids: ['s', 'm'] },
        { attribute_id: 'color', value_ids: ['black'] },
      ]);

      axes = toggleAxisValue(axes, 'color', 'black');
      axes = toggleAxisValue(axes, 'size', 's');

      expect(axes).toEqual([{ attribute_id: 'size', value_ids: ['m'] }]);
    });

    it('names attributes and values in the language, English then the code as fallback', () => {
      expect(attributeName(sizeAttribute, 'it')).toBe('Taglia');
      expect(attributeName(colorAttribute, 'de')).toBe('Colour');
      expect(valueLabel(colorAttribute.values[0], 'it')).toBe('Nero');
      expect(valueLabel(colorAttribute.values[1], 'fr')).toBe('White');
      expect(valueLabel({ ...colorAttribute.values[1], label: {} }, 'fr')).toBe('white');
    });
  });

  describe('product form', () => {
    it('starts from a storable product with the default VAT and no kit', () => {
      const empty = emptyProduct();

      expect(empty.product_type).toBe('storable');
      expect(empty.kit_type).toBeNull();
      expect(empty.track_inventory).toBe(true);
      expect(empty.uom_precision).toBe(4);
    });

    it('turns empty strings into null, but keeps the required text for the API to report', () => {
      const cleaned = cleanPayload({
        sku: '',
        name: '  ',
        description: '',
        barcode: ' ',
        tares_code: '85176200',
      });

      expect(cleaned.description).toBeNull();
      expect(cleaned.barcode).toBeNull();
      expect(cleaned.sku).toBe('');
      expect(cleaned.name).toBe('  ');
      expect(cleaned.tares_code).toBe('85176200');
    });

    it('applies the stock rules of types and kits', () => {
      expect(stockRules('storable', null)).toEqual({
        tracksStock: true,
        locked: false,
        kitAllowed: true,
      });
      expect(stockRules('service', null)).toEqual({
        tracksStock: false,
        locked: true,
        kitAllowed: false,
      });
      expect(stockRules('digital', null).kitAllowed).toBe(false);
      expect(stockRules('storable', 'phantom')).toEqual({
        tracksStock: false,
        locked: true,
        kitAllowed: true,
      });
      expect(stockRules('consumable', 'physical').tracksStock).toBe(true);
    });

    it('checks the GS1 check digit of barcodes of a GTIN length only', () => {
      expect(isGtinValid('4006381333931')).toBe(true);
      expect(isGtinValid('4006381333932')).toBe(false);
      expect(isGtinValid('96385074')).toBe(true);
      expect(isGtinValid('14006381333938')).toBe(true);
      expect(isGtinValid('LABEL-0001')).toBe(true);
      expect(isGtinValid('12345')).toBe(true);
      expect(isGtinValid(null)).toBe(true);
      expect(isGtinValid('')).toBe(true);
    });

    it('checks the Swiss Tares and the TARIC formats', () => {
      expect(isTaresValid('85176200')).toBe(true);
      expect(isTaresValid('8517')).toBe(false);
      expect(isTaresValid('')).toBe(true);
      expect(isTaricValid('610910')).toBe(true);
      expect(isTaricValid('8517620000')).toBe(true);
      expect(isTaricValid('85176')).toBe(false);
      expect(isTaricValid(null)).toBe(true);
    });

    it('names a unit with the dictionary text, or the stored name when the dictionary has none', () => {
      const unit = { id: 'u', code: 'PZ', name: 'Piece' };

      expect(unitLabel(unit, () => 'Pezzo')).toBe('Pezzo');
      expect(unitLabel(unit, (key) => key)).toBe('Piece');
      expect(unitLabel(unit, () => '')).toBe('Piece');
    });
  });

  describe('kit bill of materials', () => {
    it('accepts a valid list', () => {
      expect(
        kitProblems('kit', [
          { component_id: 'a', quantity: '2', is_optional: false },
          { component_id: 'b', quantity: '0.5', is_optional: true },
        ]),
      ).toEqual([]);
    });

    it('reports an empty line, the kit itself, a repeated component and a bad quantity', () => {
      const problems = kitProblems('kit', [
        { component_id: '', quantity: '1', is_optional: false },
        { component_id: 'kit', quantity: '1', is_optional: false },
        { component_id: 'a', quantity: '1', is_optional: false },
        { component_id: 'a', quantity: '0', is_optional: false },
      ]);

      expect(problems).toEqual([
        'productCatalog.error.component_not_found',
        'productCatalog.error.kit_contains_itself',
        'productCatalog.error.duplicate_component',
        'productCatalog.error.component_quantity_invalid',
      ]);
    });
  });

  describe('packaging hierarchy', () => {
    const levels = [
      {
        ...emptyLevel(),
        code: 'PALLET960',
        uom_id: 'u',
        units_per_parent: '40',
        parent_code: 'CARTON24',
      },
      { ...emptyLevel(), code: 'PACK6', uom_id: 'u', units_per_parent: '6' },
      {
        ...emptyLevel(),
        code: 'CARTON24',
        uom_id: 'u',
        units_per_parent: '4',
        parent_code: 'PACK6',
      },
    ];

    it('chains the factor of every level to the base unit, whatever the order', () => {
      const { factors, problems } = chainFactors(levels);

      expect(problems).toEqual([]);
      expect(trimDecimal(factors['PACK6'])).toBe('6');
      expect(trimDecimal(factors['CARTON24'])).toBe('24');
      expect(trimDecimal(factors['PALLET960'])).toBe('960');
    });

    it('keeps fractions exact', () => {
      const { factors } = chainFactors([
        { ...emptyLevel(), code: 'HALF', uom_id: 'u', units_per_parent: '0.5' },
        { ...emptyLevel(), code: 'BOX', uom_id: 'u', units_per_parent: '3', parent_code: 'HALF' },
      ]);

      expect(trimDecimal(factors['BOX'])).toBe('1.5');
    });

    it('reports a cycle, an unknown parent and a quantity that is not positive', () => {
      expect(
        chainFactors([
          { ...emptyLevel(), code: 'A', uom_id: 'u', units_per_parent: '2', parent_code: 'B' },
          { ...emptyLevel(), code: 'B', uom_id: 'u', units_per_parent: '2', parent_code: 'A' },
        ]).problems,
      ).toContain('productCatalog.error.packaging_cycle');
      expect(
        chainFactors([
          { ...emptyLevel(), code: 'A', uom_id: 'u', units_per_parent: '2', parent_code: 'X' },
        ]).problems,
      ).toContain('productCatalog.error.packaging_parent_unknown');
      expect(
        chainFactors([{ ...emptyLevel(), code: 'A', uom_id: 'u', units_per_parent: '0' }]).problems,
      ).toContain('productCatalog.error.packaging_quantity_invalid');
    });

    it('turns the levels the API saved into the payload, resolving the parent ids to codes', () => {
      const payload = packagingToPayload([
        {
          id: 'p1',
          code: 'PACK6',
          role: 'sales',
          uom_id: 'u',
          parent_packaging_id: null,
          units_per_parent: '6.000000',
          gtin: null,
        },
        {
          id: 'p2',
          code: 'CARTON24',
          role: 'purchase',
          uom_id: 'u',
          parent_packaging_id: 'p1',
          units_per_parent: '4.000000',
          gtin: '4006381333931',
        },
      ]);

      expect(payload.map((level) => level.parent_code)).toEqual([null, 'PACK6']);
      expect(payload[1].gtin).toBe('4006381333931');
    });
  });
});
