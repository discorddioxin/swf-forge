package
{
   import com.gaiaonline.games.gPinball.compound_elements.KickBumper;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1003")]
   public dynamic class PinballKickBumper extends KickBumper
   {
      
      public function PinballKickBumper()
      {
         super();
         addFrameScript(0,frame1);
      }
      
      internal function frame1() : *
      {
         stop();
      }
   }
}

