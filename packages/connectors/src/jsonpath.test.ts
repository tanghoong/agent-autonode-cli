import { describe, it, expect } from 'vitest';
import { queryJsonPath } from './jsonpath';

const data = {
  user: { name: 'Alice', age: 30 },
  items: [
    { name: 'a', price: 5, active: true },
    { name: 'b', price: 15, active: false },
    { name: 'c', price: 25, active: true },
  ],
  tags: ['x', 'y', 'z'],
};

describe('queryJsonPath', () => {
  it('returns the root with $', () => {
    expect(queryJsonPath(data, '$')).toEqual([data]);
  });

  it('resolves nested member access', () => {
    expect(queryJsonPath(data, '$.user.name')).toEqual(['Alice']);
  });

  it('supports bracket member access with quotes', () => {
    expect(queryJsonPath(data, "$['user']['name']")).toEqual(['Alice']);
  });

  it('resolves array index access', () => {
    expect(queryJsonPath(data, '$.tags[1]')).toEqual(['y']);
  });

  it('supports negative array indices', () => {
    expect(queryJsonPath(data, '$.tags[-1]')).toEqual(['z']);
  });

  it('returns an empty array for missing paths', () => {
    expect(queryJsonPath(data, '$.user.missing')).toEqual([]);
    expect(queryJsonPath(data, '$.tags[99]')).toEqual([]);
  });

  it('expands a wildcard over array elements', () => {
    expect(queryJsonPath(data, '$.items[*].name')).toEqual(['a', 'b', 'c']);
  });

  it('expands a wildcard over object values', () => {
    expect(queryJsonPath(data, '$.user.*')).toEqual(['Alice', 30]);
  });

  it('filters array elements by boolean equality', () => {
    expect(queryJsonPath(data, '$.items[?(@.active==true)].name')).toEqual(['a', 'c']);
  });

  it('filters array elements by numeric comparison', () => {
    expect(queryJsonPath(data, '$.items[?(@.price>10)].name')).toEqual(['b', 'c']);
  });

  it('filters array elements by string equality', () => {
    expect(queryJsonPath(data, "$.items[?(@.name=='b')].price")).toEqual([15]);
  });

  it('treats == loosely across number/string forms', () => {
    expect(queryJsonPath(data, "$.items[?(@.price=='15')].name")).toEqual(['b']);
  });

  it('supports strict !== in filters', () => {
    expect(queryJsonPath(data, '$.items[?(@.active!==true)].name')).toEqual(['b']);
  });

  it('does not leak inherited prototype members', () => {
    expect(queryJsonPath(data, '$.toString')).toEqual([]);
    expect(queryJsonPath(data, '$.constructor')).toEqual([]);
    expect(queryJsonPath(data, '$.__proto__')).toEqual([]);
    expect(queryJsonPath(data, '$.user.hasOwnProperty')).toEqual([]);
  });

  it('supports bracket (dashed) keys inside filters', () => {
    const dashed = {
      items: [
        { name: 'a', 'is-active': true },
        { name: 'b', 'is-active': false },
      ],
    };
    expect(queryJsonPath(dashed, "$.items[?(@['is-active']==true)].name")).toEqual(['a']);
  });

  it('throws on an unsupported filter path rather than dropping matches', () => {
    expect(() => queryJsonPath(data, '$.items[?(@[*]==1)]')).toThrow(/unsupported filter path/);
  });

  it('throws on an expression that does not start with $', () => {
    expect(() => queryJsonPath(data, 'user.name')).toThrow(/must start with/);
  });

  it('throws on an unbalanced bracket', () => {
    expect(() => queryJsonPath(data, '$.items[0')).toThrow(/unbalanced/);
  });

  it('throws on an unsupported bracket token', () => {
    expect(() => queryJsonPath(data, '$.items[foo]')).toThrow(/unsupported bracket/);
  });

  it('throws on a filter without a comparison operator', () => {
    expect(() => queryJsonPath(data, '$.items[?(@.active)]')).toThrow(/comparison operator/);
  });
});
