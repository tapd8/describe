/**
 * @author lg<lirufei0808@gmail.com>
 * @date 2020/7/29 1:53 下午
 * @description
 */
load('../type-detect.js');
load('../deep-eql.js');
load('../describe.js');

describe('A human-readable description of the test group.', {
    beforeAll: function(){
        print('Execute before running all test cases.');
    },
    beforeEach: function(){
        print('Execute before each test case runs.');
    },
    afterAll () {
        print('Execute after running all test cases.');
    },
    afterEach () {
        print('Execute after each test case runs.');
    },
    'throw error': function () {
        throw new Error('throw custom error');
    },
    'native assert': function () {
        assert(1 === 2)
    },
    'assert array equals': function () {
        this.expect([1, 2], [2, 1]);
        this.expect([1, 2,3 ], [2, 1, 3]);
        print('assert array equals done.');
    }
});

describe('Test case group 2', {
    'assert object equals': function () {
        let a = new Date();
        let b = new Date(a.getTime());
        this.expect(a, b);

        this.expect([1,2], [1, 2]); // true
        this.expect([5,3,4,1,6].sort(), [1, 5,4,3,6].sort());    // true

        this.expect([{a: 1, b: [{c: 2}]}], [{b: [{c: 2}], a: 1}]);  // true

        let same = deepEqual([{a: 1, b: [{d: 1}, {c: 2}]}], [{b: [{c: 2}, {d: 1}], a: 1}]); // false
        this.expect(same, false);
        return 'passed';
    },
    'assert equals': function () {
        this.expect(45, 45);
        this.expect(true, true);
        this.expect('字符串', '字符串');
        this.expect('字符串', '字符串');
        print('assert equals done.');
        return true;
    },
    ['assert test'] () {
        this.expect('a', 'b');
        this.expect('c', 'd');
    }
});

describe.logResults();
describe.getResults(printjson);
