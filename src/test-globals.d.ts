/**
 * Globali usate solo dai test.
 *
 * `IS_REACT_ACT_ENVIRONMENT` è il flag con cui React abilita `act()` fuori da
 * un test runner che lo imposta da sé: i test di Pratix lo valorizzano a mano
 * nei `beforeEach`. Non fa parte dei tipi DOM, quindi va dichiarato qui.
 */
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

export {};
