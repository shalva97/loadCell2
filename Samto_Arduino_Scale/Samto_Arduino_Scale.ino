#include <HX711.h> //ADC library

//pinouts
int relay_pin1 = 7;
int relay_pin2 = 8;

//serial stuff
bool stringComplete = false;
String inputString = "";
unsigned long interval = 500; //enters main loop after this many second
unsigned long interval_counter = 0;

//adc variables
HX711 adc_zlbs;
HX711 adc_epsilon;
double cur_KG = -1;
double pre_KG = -1;
double cur_MM = -1;
double pre_MM = -1;
int scale_zlbs = 147;    //calibration value
int scale_epsilon = 147; //calibration value

//safety
bool sos = false;
bool sos1 = false;
bool sos2 = false;
bool sos3 = false;
int lastNofReadings = 20; //print data sosCountLimit times after sos
int max_KG = 17;          //max allowed KG for Scale, prints sos after that, and puts fsm into STOP state
int max_MM = 5;           //max allowed MM for Epsilon, prints sos after that, and puts fsm into STOP state
int min_KG = -2;          //min allowed KG, so it will not push down, SHOULD be less than pre_KG and cur_KG

//finite state machine states
enum fsmstates
{
  ZEROSTATE,       //0, local
  CALIBRATE_SCALE, //1, terminal
  START,           //2, UI
  PAUSE,           //3, UI
  CONTINUE,        //4, UI
  STOP,            //5, UI
  GOUP,            //6, UI
  GODOWN,          //7, UI
  PRINT_ADC_DATA  //8, local
  // SIMULATE1,       //9, terminal
  // SIMULATE2,       //10, terminal
  // SIMULATE3        //11, terminal
};
enum fsmstates state = ZEROSTATE;

//-------------------------setup()--------------------------------------------------------------------//
void setup()
{
  Serial.begin(9600);

  //control of relays
  pinMode(relay_pin1, OUTPUT);
  pinMode(relay_pin2, OUTPUT);

  adc_epsilon.begin(A1, A0);            //set pinouts
  adc_epsilon.set_scale(scale_epsilon); //147 comes from initial calibration

  adc_zlbs.begin(A3, A2);         //set pinouts
  adc_zlbs.set_scale(scale_zlbs); //147 comes from initial calibration
  // log("Setup Complete");
  interval_counter = millis();
}

//---------------------------loop()---------------------------------------------------------------//
void loop()
{
  // Serial.println("LOGGING");
  // Serial.println(interval_counter);
  // Serial.println(millis());
  // 500             <    3101    2600
  //delay(5);
  if (interval <= (millis() - interval_counter))
  {
    // Serial.println("ENTERED CONDITION");
    interval_counter = millis();

    switch (state)
    {
    case ZEROSTATE:
    // Serial.println("ZERO STATE BEEEACCHHH");
      break;

    case CALIBRATE_SCALE:
      // log("calibrate scale state");
      state = ZEROSTATE;
      F_Calibrate_Scale();
      break;

    case START:
      // log("start state");
      if (sos1 != true and sos3 != true)
      {
        pre_KG = 0;
        pre_MM = 0;
        cur_KG = 0;
        cur_MM = 0;
        state = PRINT_ADC_DATA;
        F_Calibrate_Epsilon();
        digitalWrite(relay_pin1, HIGH);
        digitalWrite(relay_pin2, LOW);
      }
      else
        Serial.println("Can't do that, Fix Over KG on Scale or Over streching of Extensometer");
      break;

    case PAUSE:
      // log("pause state");
      state = PRINT_ADC_DATA;
      digitalWrite(relay_pin1, LOW);
      digitalWrite(relay_pin2, LOW);
      break;

    case CONTINUE:
      // log("continue state");
      if (sos1 != true and sos3 != true)
      {
        state = PRINT_ADC_DATA;
        digitalWrite(relay_pin1, HIGH);
        digitalWrite(relay_pin2, LOW);
      }
      else
        Serial.println("Can't do that, Fix Over KG on Scale or Over streching of Extensometer");
      break;

    case STOP:
      // log("stop state");
      state = ZEROSTATE;
      digitalWrite(relay_pin1, LOW);
      digitalWrite(relay_pin2, LOW);
      F_printNreadings();
      break;

    case GOUP:
      // log("go up state");
      if (sos1 != true and sos3 != true)
      {
        state = PRINT_ADC_DATA;
        digitalWrite(relay_pin1, HIGH);
        digitalWrite(relay_pin2, LOW);
      }
      else
        Serial.println("Can't do that, Fix Over KG on Scale or Over streching of Extensometer");
      break;

    case GODOWN:
      // log("go down state");
      if (sos2 != true)
      {
        state = PRINT_ADC_DATA;
        digitalWrite(relay_pin1, LOW);
        digitalWrite(relay_pin2, HIGH);
      }
      else
        Serial.println("Can't do that, Fix Under KG on Scale");
      break;

    case PRINT_ADC_DATA:
      F_read_from_Scale();
      F_read_from_Epsilon();
      Serial.print(cur_KG, 3);
      Serial.print('/');
      Serial.print(cur_MM, 5);
      Serial.print('\n');
      break;

    // case SIMULATE1:
    //   Serial.println("LOG: sim 1 state");
    //   break;

    // case SIMULATE2:
    //   // log("simulate 2 state");
    //   break;

    // case SIMULATE3:
    //   // log("simulate 3 state");
    //   break;

    default:
      // log("Unknown Command");
      break;
    }

    // --------------------- declare sos* as true if safety rules are violated, if not, clear them ---------------------
    if ((pre_MM > max_MM) and (cur_MM > max_MM) and (sos1 == false)) //too much stretch, but not yet detected
    {
      // log("sos 1 state");
      Serial.println("sos1");
      sos1 = true;
      state = PRINT_ADC_DATA;
      digitalWrite(relay_pin1, LOW);
      digitalWrite(relay_pin2, LOW);
    }
    if ((pre_MM < max_MM) and (cur_MM < max_MM))
      sos1 = false;

    if ((pre_KG < min_KG) and (cur_KG < min_KG) and (sos2 == false)) //negative KGs, but not yet detected
    {
      // log("sos 2 state");
      Serial.println("sos2");
      sos2 = true;
      state = PRINT_ADC_DATA;
      digitalWrite(relay_pin1, LOW);
      digitalWrite(relay_pin2, LOW);
    }
    if ((pre_KG > min_KG) and (cur_KG > min_KG))
      sos2 = false;

    if ((pre_KG > max_KG) and (cur_KG > max_KG) and (sos3 == false)) //too much KGs, but not yet detected
    {
      // log("sos 3 state");
      Serial.println("sos3");
      sos3 = true;
      state = PRINT_ADC_DATA;
      digitalWrite(relay_pin1, LOW);
      digitalWrite(relay_pin2, LOW);
    }
    if ((pre_KG < max_KG) and (cur_KG < max_KG))
      sos3 = false;

    sos = sos1 or sos2 or sos3;
    // Serial.println("TIME:");
    // Serial.println(interval_counter);
    // Serial.println(millis());
  }
}

//----------------------------+ F_Calibrate_Scale()------------------------------------------------------------//
void F_Calibrate_Scale()
{
  long int sum = 0;
  for (int i = 0; i < 10; i++)
  {
    sum += adc_zlbs.read();
    yield();
  }
  double offset = sum / 10;
  adc_zlbs.set_offset(offset);
}

//----------------------------+ F_Calibrate_Epsilon()----------------------------------------------------------//
void F_Calibrate_Epsilon()
{
  long int sum = 0;
  for (int i = 0; i < 10; i++)
  {
    sum += adc_epsilon.read();
    yield();
  }
  double offset = sum / 10;
  adc_epsilon.set_offset(offset);
}

//----------------------------+ F_read_from_Scale()---------------------------------------------------------//
void F_read_from_Scale()
{
  pre_KG = cur_KG;
  long int read_from_Scale = adc_zlbs.read();                    // read value from sensor
  long int difference = read_from_Scale - adc_zlbs.get_offset(); // get difference between sensor value and zore value
  double changeScale = difference / adc_zlbs.get_scale();        // change the scale of valueOfadc_scale
  cur_KG = changeScale / 1000;                                   // get the final value to KG;
}

//----------------------------+ F_read_from_Epsilon()-------------------------------------------------------//
void F_read_from_Epsilon()
{
  pre_MM = cur_MM;
  long int read_from_Epsilon = adc_epsilon.read();                    // read value from sensor
  long int difference = read_from_Epsilon - adc_epsilon.get_offset(); // get difference between sensor value and zore value
  double changeScale = difference / adc_epsilon.get_scale();          // change the scale of valueOfadc_scale
  cur_MM = changeScale / 5410;                                        // get the final value to KG;
}

//----------------------------+ F_serial_Event()----------------------------------------------------------------//
void serialEvent()
{
  state = ZEROSTATE;
  inputString = "";
  while (Serial.available())
  {
    char inChar = (char)Serial.read();
    inputString += inChar;
    if (inChar == '\n' or inChar == '\r')
    {
      stringComplete = true;
    }
  }
  state = inputString.toInt();
}

void F_printNreadings()
{
  int lastNofReadingsCount = 0;

  while (lastNofReadingsCount++ < lastNofReadings)
  {
    F_read_from_Scale();
    F_read_from_Epsilon();
    Serial.print(cur_KG, 3);
    Serial.print('/');
    Serial.print(cur_MM, 5);
    Serial.print('\n');
    delay(interval/5);
  }
}

// void log(String x)
// {
//   Serial.println("LOG: " + x);
// }

// void log2(String x)
// {
//   Serial.println("LOG: " + x);
// }