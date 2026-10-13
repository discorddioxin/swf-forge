package game_fla
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import flash.display.MovieClip;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1569")]
   public dynamic class mcHelsonBumperGraphic01_234 extends MovieClip
   {
      
      public function mcHelsonBumperGraphic01_234()
      {
         super();
         addFrameScript(1,frame2,6,frame7,8,frame9,14,frame15,16,frame17,23,frame24);
      }
      
      internal function frame15() : *
      {
         PinballCore.__Table.helsonramp.doLightning("ON");
      }
      
      internal function frame7() : *
      {
         PinballCore.__Table.helsonramp.doLightning("ON");
      }
      
      internal function frame17() : *
      {
         PinballCore.__Table.helsonramp.doLightning("FADE");
      }
      
      internal function frame24() : *
      {
         gotoAndStop("OFF");
      }
      
      internal function frame9() : *
      {
         PinballCore.__Table.helsonramp.doLightning("FADE");
      }
      
      internal function frame2() : *
      {
         PinballCore.__Table.helsonramp.doLightning("OFF");
         stop();
      }
   }
}

