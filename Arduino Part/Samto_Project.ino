#include <HX711.h> //ADC library

//main commands
int startS = 0;
int stopS = 0;
int pauseS = 0;
int upS = 0;
int downS = 0;
int calibrateScaleS = 0;

//serial communication
String inputString = "";
bool stringComplete = false;
t_print_delay = 100;

//print stuff
bool sos_is_printed = 0;
bool permit_to_print = 0;
int counter_after_sos = 0;

//ADCs related 
double pre_KG = 0; //previously read KG
double cur_KG = 0; //currently read KG
double cur_MM = 0; //currently read milimiters

//create objects for scale and epsilon
HX711 adc_scale;
HX711 adc_epsilon;

//-------------------------setup()--------------------------------------------------------------------//
void setup() {
  Serial.begin(9600); //TS 1 - can we increase the speed?

  //control of relays
  pinMode(7, OUTPUT);
  pinMode(8, OUTPUT);

  adc_epsilon.begin(A3, A2); //set pinouts
  adc_epsilon.set_scale(147); //147 comes from initial calibration

  adc_scale.begin(A1, A0); //set pinouts
  adc_scale.set_scale(147); //147 comes from initial calibration
}

//---------------------------loop()---------------------------------------------------------------//
void loop() {

  if (stringComplete = true) {
    F_check_input_Commands();
    F_control_servo_Motor();
  }  


  if (calibrateScaleS == 1){
    F_Calibrate_Scale(); 
  }

  if (startS == 1 || pauseS == 1) {
    F_read_from_adc_Scale();
    F_read_from_adc_Epsilon();

    //add delay, so it won't print very quickly
    delay(t_print_delay);

    // - - - - - - R U L E S : When To Print, and When not to - - - S T A R T 
    // stop printing after printing 15 values 'after sos detection'
    if (sos_is_printed == 1 ) {
      counter_after_sos ++;
      if (counter_after_sos > 15) permit_to_print = 0;
    }

    //print KG and Epsilon Milimeters
    if (permit_to_print == 1) {
      Serial.print(cur_KG);
      Serial.print('/');
      Serial.print(cur_MM, 3);
      Serial.println();
    }
    // - - - - - - R U L E S : When To Print, and When not to - - - E N D 


    // - - - - - - S O S  - -  S I G N A L S  - - S T A R T - - - - - -
    //SOS 1, material was stretched a lot, more than 9 mm
    if (cur_MM > 9) {
      inputString = "pause"; // So we can still continue printing until counter_after_sos stops printage
      stringComplete = true;
      if (!sos_is_printed) {
        Serial.println("sos1"); //check if SOS is already printed, don't print twice
        sos_is_printed = 1;
      }
    }

    // SOS 2, Sudden decrease in KG, broken material
    if (abs(pre_KG) > abs(cur_KG + 0.40) and permit_to_print == 1)  {
      inputString = "pause"; // So we can still continue printing until counter_after_sos stops printage
      stringComplete = true;
      if (!sos_is_printed) {
        Serial.println("sos2"); //check if SOS is already printed, don't print twice
        sos_is_printed = 1;
      }
      pre_KG = 0;
    } else pre_KG = cur_KG;

    // SOS 3, too much KG
    if (cur_KG >= 25) {
      inputString = "pause"; // So we can still continue printing until counter_after_sos stops printage
      stringComplete = true;
      pre_KG = 0;
      if (!sos_is_printed) {
        Serial.println("sos3"); //check if SOS is already printed, don't print twice
        sos_is_printed = 1;
      }
    }
    // - - - - - - S O S  - -  S I G N A L S  - - E N D - - - - - -
  }
}


//----------------------------F_Calibrate_Scale()------------------------------------------------------------//
void F_Calibrate_Scale() {
  long int sum = 0;
  for (int i = 0; i < 10; i++) {
    sum += adc_scale.read();
    yield();
  }
  double offset = sum / 10;
  adc_scale.set_offset(offset);
}

//--------------------------F_Calibrate_Epsilon()----------------------------------------------------------//
void F_Calibrate_Epsilon() {
  long int sum = 0;
  for (int i = 0; i < 10; i++) {
    sum += adc_epsilon.read();
    yield();
  }
  double offset = sum / 10;
  adc_epsilon.set_offset(offset);
}

//---------------------------F_read_from_adc_Scale()------------------------------------------------------------//
void F_read_from_adc_Scale() {
  long int F_read_from_adc_Scale = adc_scale.read();            // read value from sensor
  long int difference = F_read_from_adc_Scale - adc_scale.get_offset();   // get difference between sensor value and zore value
  double changeScale = difference / adc_scale.get_scale();      // change the scale of valueOfadc_scale
  cur_KG = changeScale / 1000;                                   // get the final value to KG;
}

//-------------------------F_read_from_adc_Epsilon()---------------------------------------------//
void F_read_from_adc_Epsilon() {
  long int F_read_from_adc_Epsilon = adc_epsilon.read();          // read value from sensor
  long int difference = F_read_from_adc_Epsilon - adc_epsilon.get_offset();   // get difference between sensor value and zore value
  double changeScale = difference / adc_epsilon.get_scale();      // change the scale of valueOfadc_scale
  cur_MM = changeScale / 5410;                                     // get the final value to KG;
}

//-------------F_serial_Event()------------------------------------------------------------//
void F_serial_Event() {
  while (Serial.available() > 0) {
    char inChar = Serial.read();
    if (inChar != '\n' && inChar != '\r')
      inputString += inChar;
    else
      stringComplete = true;
  }
}

//-------------------------F_check_input_Commands()----------------------------------------------------//
void F_check_input_Commands() {
      //Default Values Start
      pauseS = 0;
      startS = 0;
      stopS = 0;
      upS = 0;
      downS = 0;
      inputString = "";
      stringComplete = false;
      //Default Values end

  if (stringComplete) {
    if (inputString == "start") {   startS = 1;
      sos_is_printed = 0; //after that, it can print SOS again, if happens
      counter_after_sos = 0; //counter reset
      permit_to_print = 1; //it can print KG and MM again
      F_Calibrate_Epsilon();
    }
    if (inputString == "stop")      stopS = 1;
    if (inputString == "pause")     pauseS = 1;
    if (inputString == "up")        upS = 1;
    if (inputString == "down")      downS = 1;
    if (inputString == "calibrate_scale") calibrateScaleS = 1;
  }
}

//---------------------------F_control_servo_Motor()-------------------------------------------------//
void F_control_servo_Motor() {
  if (startS == 1) {
    digitalWrite(7, HIGH);
    digitalWrite(8, LOW);
  }
  if (stopS == 1) {
    digitalWrite(7, LOW);
    digitalWrite(8, LOW);
  }
  if (pauseS == 1) {
    digitalWrite(7, LOW);
    digitalWrite(8, LOW);
  }
  if (upS == 1) {
    digitalWrite(7, HIGH);
    digitalWrite(8, LOW);
  }
  if (downS == 1) {
    digitalWrite(7, LOW);
    digitalWrite(8, HIGH);
  }
}
