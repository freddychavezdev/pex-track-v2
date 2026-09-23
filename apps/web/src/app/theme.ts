import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

const ocean = {
  50: '#f0f9fb',
  100: '#d9f0f4',
  200: '#b9e1e8',
  300: '#8dced9',
  400: '#5eb4c4',
  500: '#3795aa',
  600: '#2b788f',
  700: '#286273',
  800: '#28515f',
  900: '#254550',
  950: '#122b35'
};

const PexTrackTheme = definePreset(Aura, {
  primitive: { ocean },
  semantic: {
    primary: {
      50: '{teal.50}',
      100: '{teal.100}',
      200: '{teal.200}',
      300: '{teal.300}',
      400: '{teal.400}',
      500: '{teal.500}',
      600: '{teal.600}',
      700: '{teal.700}',
      800: '{teal.800}',
      900: '{teal.900}',
      950: '{teal.950}'
    },
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff',
          50: '{ocean.50}',
          100: '{ocean.100}',
          200: '{ocean.200}',
          300: '{ocean.300}',
          400: '{ocean.400}',
          500: '{ocean.500}',
          600: '{ocean.600}',
          700: '{ocean.700}',
          800: '{ocean.800}',
          900: '{ocean.900}',
          950: '{ocean.950}'
        }
      },
      dark: {
        surface: {
          0: '#ffffff',
          50: '{ocean.950}',
          100: '#102b35',
          200: '#153b47',
          300: '#1c4d5a',
          400: '{ocean.700}',
          500: '{ocean.600}',
          600: '{ocean.500}',
          700: '{ocean.400}',
          800: '{ocean.300}',
          900: '{ocean.200}',
          950: '{ocean.100}'
        }
      }
    }
  }
});

export default PexTrackTheme;
