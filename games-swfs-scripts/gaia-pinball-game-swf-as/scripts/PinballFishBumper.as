package
{
   import com.gaiaonline.games.gPinball.compound_elements.Bumper;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1157")]
   public dynamic class PinballFishBumper extends Bumper
   {
      
      public function PinballFishBumper()
      {
         super();
         addFrameScript(0,frame1);
      }
      
      internal function frame1() : *
      {
         bumperInit(null);
         stop();
      }
   }
}

